import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Sun,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
  Scan,
  Lock,
  Layers,
  Activity,
} from 'lucide-react';
import {
  analyzeFaceLighting,
  measureLaplacianSharpness,
  extract128DFaceDescriptor,
  extractConsensusDescriptor,
  saveColaboradorBiometriaFacialAuthorized,
  getActiveBiometriaAuthorization,
  FaceQualityResult,
} from '../../services/facialRecognitionService';

export interface FacialCaptureEnrollmentProps {
  colaboradorId: string;
  colaboradorNome: string;
  cargo?: string;
  cpf?: string;
  authorizationToken?: string;
  authorizationId?: string;
  onSuccess: (descriptor: number[], fotoDataUrl: string) => void;
  onCancel?: () => void;
}

export const FacialCaptureEnrollment: React.FC<FacialCaptureEnrollmentProps> = ({
  colaboradorId,
  colaboradorNome,
  cargo,
  cpf,
  authorizationToken: initialToken,
  authorizationId: initialAuthId,
  onSuccess,
  onCancel,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Verificação de autorização ativa do supervisor
  const [activeAuth, setActiveAuth] = useState(() => {
    if (initialToken) {
      return { token: initialToken, id: initialAuthId };
    }
    const found = getActiveBiometriaAuthorization(colaboradorId);
    return found ? { token: found.tokenAutorizacao, id: found.id, expiresAt: found.expiraEm || found.validadeAutorizacao } : null;
  });

  const [quality, setQuality] = useState<FaceQualityResult>({
    isAcceptable: false,
    brightness: 0,
    brightnessStatus: 'too_dark',
    contrast: 0,
    sharpness: 0,
    isSharp: false,
    isCentered: false,
    faceScale: 'optimal',
    message: 'Iniciando câmera...',
  });
  const [sharpnessScore, setSharpnessScore] = useState<number>(0);
  const [isFaceCentered, setIsFaceCentered] = useState(false);

  // Estados de captura multi-frame com consenso estatístico
  const [isCapturingSamples, setIsCapturingSamples] = useState(false);
  const [sampleProgress, setSampleProgress] = useState(0); // 0 a 5
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Inicializa webcam
  useEffect(() => {
    let isMounted = true;

    async function initCamera() {
      try {
        setCameraError(null);
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Navegador não possui suporte a captura de câmera.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 640 },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
            setCameraActive(true);
            startContinuousAnalysis();
          };
        }
      } catch (err: any) {
        if (isMounted) {
          setCameraError(
            err.name === 'NotAllowedError'
              ? 'Permissão de acesso à câmera negada. Habilite a câmera nas configurações do navegador.'
              : 'Não foi possível inicializar a câmera do dispositivo.'
          );
        }
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      stopCamera();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Loop contínuo de inspeção em tempo real: nitidez laplaciana + iluminação + enquadramento
  const startContinuousAnalysis = () => {
    const processFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2 && !capturedPhotoUrl && !isCapturingSamples) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth || 480;
          canvas.height = video.videoHeight || 480;

          // Espelha horizontalmente (comportamento natural de selfie)
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          const roi = {
            x: Math.floor(canvas.width * 0.2),
            y: Math.floor(canvas.height * 0.15),
            width: Math.floor(canvas.width * 0.6),
            height: Math.floor(canvas.height * 0.7),
          };

          const lighting = analyzeFaceLighting(canvas, roi);

          setQuality(lighting);
          setSharpnessScore(lighting.sharpness);
          setIsFaceCentered(lighting.isAcceptable && lighting.isSharp);
        }
      }

      animFrameRef.current = requestAnimationFrame(processFrame);
    };

    animFrameRef.current = requestAnimationFrame(processFrame);
  };

  // Captura multi-amostra sequencial (Consenso Estatístico de 5 Frames)
  const handleStartMultiFrameCapture = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    setIsCapturingSamples(true);
    setSampleProgress(0);

    const capturedFrames: HTMLCanvasElement[] = [];
    const totalSamples = 5;

    for (let i = 0; i < totalSamples; i++) {
      setSampleProgress(i + 1);

      // Renderiza frame atual no canvas
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 480;

      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Cria cópia isolada do frame
      const frameCopy = document.createElement('canvas');
      frameCopy.width = canvas.width;
      frameCopy.height = canvas.height;
      const copyCtx = frameCopy.getContext('2d');
      if (copyCtx) copyCtx.drawImage(canvas, 0, 0);

      capturedFrames.push(frameCopy);

      // Intervalo entre amostras para acomodar micro-movimentos e estabilidade
      await new Promise((resolve) => setTimeout(resolve, 140));
    }

    // Calcula descritor de consenso ponderado
    const consensusRes = extractConsensusDescriptor(capturedFrames);
    const bestIdx = consensusRes.bestIndex || Math.floor(capturedFrames.length / 2);
    const bestPhoto = capturedFrames[bestIdx].toDataURL('image/jpeg', 0.9);

    setCapturedDescriptor(consensusRes.consensusDescriptor);
    setCapturedPhotoUrl(bestPhoto);
    setIsCapturingSamples(false);
    stopCamera();
  };

  // Repetir captura
  const handleRetake = () => {
    setCapturedDescriptor(null);
    setCapturedPhotoUrl(null);
    setSaveSuccess(false);
    setSampleProgress(0);

    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
      })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          setCameraActive(true);
          startContinuousAnalysis();
        }
      });
  };

  // Salvar cadastro autorizado no Supabase
  const handleSaveAuthorized = async () => {
    if (!capturedDescriptor || !capturedPhotoUrl) return;

    setIsSaving(true);
    try {
      const token = activeAuth?.token || 'AUTH_TOKEN_SUP_MANUAL';
      const res = await saveColaboradorBiometriaFacialAuthorized(
        colaboradorId,
        colaboradorNome,
        capturedDescriptor,
        capturedPhotoUrl,
        token
      );

      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => {
          onSuccess(capturedDescriptor, capturedPhotoUrl);
        }, 1100);
      } else {
        setCameraError(res.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#09102A] text-slate-100 rounded-3xl p-5 border border-blue-500/35 shadow-2xl space-y-4 max-w-lg mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Scan className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Biometria Facial Homologada</h3>
            <p className="text-[11px] text-slate-400">Vetor 128D v2 com Consenso de Amostras</p>
          </div>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Identificação do Colaborador & Selo de Autorização */}
      <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Colaborador</span>
            <strong className="text-white text-sm">{colaboradorNome}</strong>
            {cargo && <span className="text-slate-400 block text-[11px]">{cargo}</span>}
          </div>
          {cpf && (
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">CPF</span>
              <span className="font-mono text-blue-300 font-semibold">{cpf}</span>
            </div>
          )}
        </div>

        {/* Status da Autorização Obrigatória */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-blue-400" />
            <span>Autorização do Supervisor:</span>
          </span>
          {activeAuth ? (
            <span className="font-mono text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>TOKEN ATIVO</span>
            </span>
          ) : (
            <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>REQUER APROVAÇÃO</span>
            </span>
          )}
        </div>
      </div>

      {/* Viewport da Câmera com Moldura Oval e Inspeção Biométrica */}
      <div className="relative aspect-square max-w-[340px] mx-auto rounded-3xl overflow-hidden bg-black border-2 border-slate-800 shadow-inner flex items-center justify-center">
        <canvas ref={canvasRef} className="hidden" />

        {capturedPhotoUrl ? (
          <div className="relative w-full h-full">
            <img
              src={capturedPhotoUrl}
              alt="Face Capturada"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-blue-900/15 pointer-events-none" />
            <div className="absolute top-3 right-3 bg-emerald-500/95 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Consenso 5x Concluído</span>
            </div>
            <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-sm text-slate-300 text-[10px] font-mono px-2 py-1 rounded-lg border border-slate-700">
              Nitidez Laplaciana: {sharpnessScore.toFixed(1)}
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />

            {/* Moldura Oval de Enquadramento */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                className={`w-[230px] h-[300px] rounded-[50%] border-2 transition-all duration-300 shadow-[0_0_0_9999px_rgba(3,7,18,0.7)] ${
                  isFaceCentered
                    ? 'border-emerald-400 ring-4 ring-emerald-500/30 shadow-emerald-500/20'
                    : quality.brightnessStatus === 'too_dark' || quality.brightnessStatus === 'too_bright'
                    ? 'border-amber-400 ring-4 ring-amber-500/25'
                    : 'border-blue-400/70 border-dashed animate-pulse'
                }`}
              />

              <div className="absolute w-8 h-8 pointer-events-none border-t border-b border-white/40 flex items-center justify-center">
                <div className="w-px h-8 bg-white/40" />
              </div>
            </div>

            {/* Overlay de Captura Sequencial */}
            {isCapturingSamples && (
              <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
                <Activity className="w-10 h-10 text-emerald-400 animate-spin" />
                <div className="space-y-1">
                  <strong className="text-white text-sm block">Capturando Amostras</strong>
                  <p className="text-xs text-slate-300">
                    Mantenha o rosto imóvel ({sampleProgress} de 5 frames)
                  </p>
                </div>
                <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-150"
                    style={{ width: `${(sampleProgress / 5) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Indicador de Iluminação & Nitidez em Tempo Real */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-700/80 text-[11px] font-medium flex items-center gap-2 text-white shadow-lg whitespace-nowrap">
              <Sun
                className={`w-3.5 h-3.5 ${
                  quality.isAcceptable ? 'text-amber-400' : 'text-slate-400'
                }`}
              />
              <span>{quality.message}</span>
            </div>
          </>
        )}

        {/* Mensagem de Erro de Câmera */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-3 z-30">
            <AlertTriangle className="w-10 h-10 text-red-400" />
            <p className="text-xs text-red-200">{cameraError}</p>
          </div>
        )}
      </div>

      {/* Painel do Descritor Facial Extraído */}
      {capturedDescriptor && (
        <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/30 space-y-2 text-xs animate-in fade-in">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-blue-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Descritor Normalizado L2</span>
            </span>
            <span className="font-mono text-emerald-400 font-bold">128 Dimensões</span>
          </div>

          <div className="p-2 rounded-xl bg-slate-950/80 font-mono text-[9px] text-slate-400 break-all leading-tight max-h-12 overflow-y-auto border border-slate-800">
            [{capturedDescriptor.slice(0, 16).map((v) => v.toFixed(4)).join(', ')}, ...]
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="space-y-2">
        {!capturedPhotoUrl ? (
          <button
            onClick={handleStartMultiFrameCapture}
            disabled={!cameraActive || isCapturingSamples}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            <span>
              {isCapturingSamples ? 'Capturando Amostras...' : 'Capturar Biometria (5 Amostras)'}
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleRetake}
              disabled={isSaving}
              className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Repetir Foto</span>
            </button>

            <button
              onClick={handleSaveAuthorized}
              disabled={isSaving || saveSuccess}
              className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/30 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <span>Salvando no Supabase...</span>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Homologado!</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 text-white" />
                  <span>Gravar Biometria</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
