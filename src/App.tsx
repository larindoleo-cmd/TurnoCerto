import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomBar } from './components/BottomBar';
import { OperacaoTab } from './components/tabs/OperacaoTab';
import { EquipeTab } from './components/tabs/EquipeTab';
import { PostosTab } from './components/tabs/PostosTab';
import { MatrizTab } from './components/tabs/MatrizTab';
import { HoleriteRHTab } from './components/tabs/HoleriteRHTab';
import { Posto360Modal } from './components/modals/Posto360Modal';
import { SubstituicaoModal } from './components/modals/SubstituicaoModal';
import { AlocarModal } from './components/modals/AlocarModal';
import { EscalaPostoModal } from './components/modals/EscalaPostoModal';
import { NovaOcorrenciaModal } from './components/modals/NovaOcorrenciaModal';
import { HoleriteDetalheModal } from './components/modals/HoleriteDetalheModal';
import { CadastroFuncionarioModal } from './components/modals/CadastroFuncionarioModal';
import { CondominioModal } from './components/modals/CondominioModal';
import { EmpresaModal } from './components/modals/EmpresaModal';
import { NotificationModal } from './components/NotificationModal';
import { SupabaseSettingsModal } from './components/SupabaseSettingsModal';
import { usePWAInstall } from './components/usePWAInstall';
import { PWAInstallModal } from './components/PWAInstallModal';
import { LoginScreen } from './components/LoginScreen';
import { ChangePasswordModal } from './components/modals/ChangePasswordModal';
import { RedefinirSenhaColaboradorModal } from './components/modals/RedefinirSenhaColaboradorModal';
import { CollaboratorView } from './components/collaborator/CollaboratorView';

const AppContent: React.FC = () => {
  const {
    activeTab,
    selectedPostoFor360,
    closePosto360,
    substituicaoModal,
    closeSubstituicaoModal,
    alocarModal,
    closeAlocarModal,
    escalaModal,
    closeEscalaModal,
    ocorrenciaModal,
    closeOcorrenciaModal,
    holeriteDetalhe,
    closeHoleriteDetalhe,
    cadastroModalOpen,
    closeCadastroModal,
    condominioModal,
    closeCondominioModal,
    empresaModalOpen,
    setEmpresaModalOpen,
    toastMessage,
    currentUser,
  } = useApp();

  const { isInstallable, hasNativePrompt, isIOS, install } = usePWAInstall();
  const [pwaModalOpen, setPwaModalOpen] = useState(false);

  // Se o usuário não está autenticado, exibe a tela de login
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#060913] via-[#080E22] to-[#0B132B] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
        {toastMessage && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900/95 border border-blue-500/50 text-white text-xs font-semibold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150 flex items-center gap-2 max-w-[90vw]">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
        )}
        <LoginScreen />
        <ChangePasswordModal />
        <SupabaseSettingsModal />
      </div>
    );
  }

  // =========================================================================
  // REGRA 2: ISOLAMENTO ESTRITO DE PERFIS (ROLE-BASED)
  // Funcionário acessa EXCLUSIVAMENTE a área do funcionário com barra própria
  // =========================================================================
  if (currentUser.role === 'funcionario') {
    return (
      <>
        {toastMessage && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900/95 border border-blue-500/50 text-white text-xs font-semibold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150 flex items-center gap-2 max-w-[90vw]">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
        )}
        <CollaboratorView />
        <PWAInstallModal
          isOpen={pwaModalOpen}
          onClose={() => setPwaModalOpen(false)}
          onInstall={install}
          hasNativePrompt={hasNativePrompt}
          isIOS={isIOS}
        />
      </>
    );
  }

  // =========================================================================
  // PAINEL DE GESTÃO ADMINISTRATIVO (ADMIN & SUPERVISOR)
  // =========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060913] via-[#080E22] to-[#0B132B] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Toast message alert */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900/95 border border-blue-500/50 text-white text-xs font-semibold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150 flex items-center gap-2 max-w-[90vw]">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Sticky Compact Header */}
      <Header
        onOpenInstall={() => setPwaModalOpen(true)}
        isInstallable={isInstallable}
      />

      {/* Main Viewport Container (Mobile-first responsive up to full multi-column) */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3.5 sm:px-6 pt-3 pb-24">
        {activeTab === 'operacao' && <OperacaoTab />}
        {activeTab === 'equipe' && <EquipeTab />}
        {activeTab === 'postos' && <PostosTab />}
        {activeTab === 'matriz' && <MatrizTab />}
        {activeTab === 'rh' && <HoleriteRHTab />}
      </main>

      {/* Fixed Bottom Bar */}
      <BottomBar />

      {/* Modals & 360 Panels */}
      {selectedPostoFor360 && (
        <Posto360Modal
          posto={selectedPostoFor360}
          onClose={closePosto360}
        />
      )}

      {substituicaoModal?.isOpen && (
        <SubstituicaoModal
          posto={substituicaoModal.posto}
          colaboradorFalta={substituicaoModal.colaboradorFalta}
          onClose={closeSubstituicaoModal}
        />
      )}

      {alocarModal?.isOpen && (
        <AlocarModal
          posto={alocarModal.posto}
          onClose={closeAlocarModal}
        />
      )}

      {escalaModal?.isOpen && (
        <EscalaPostoModal
          posto={escalaModal.posto}
          onClose={closeEscalaModal}
        />
      )}

      {ocorrenciaModal?.isOpen && (
        <NovaOcorrenciaModal
          posto={ocorrenciaModal.posto}
          onClose={closeOcorrenciaModal}
        />
      )}

      {holeriteDetalhe && (
        <HoleriteDetalheModal
          holerite={holeriteDetalhe}
          onClose={closeHoleriteDetalhe}
        />
      )}

      <CadastroFuncionarioModal
        isOpen={cadastroModalOpen}
        onClose={closeCadastroModal}
      />

      {condominioModal?.isOpen && (
        <CondominioModal
          isOpen={condominioModal.isOpen}
          condominio={condominioModal.condominio}
          isNovo={condominioModal.isNovo}
          onClose={closeCondominioModal}
        />
      )}

      <EmpresaModal
        isOpen={empresaModalOpen}
        onClose={() => setEmpresaModalOpen(false)}
      />

      <NotificationModal />
      <SupabaseSettingsModal />
      <ChangePasswordModal />
      <RedefinirSenhaColaboradorModal />

      <PWAInstallModal
        isOpen={pwaModalOpen}
        onClose={() => setPwaModalOpen(false)}
        onInstall={install}
        hasNativePrompt={hasNativePrompt}
        isIOS={isIOS}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
