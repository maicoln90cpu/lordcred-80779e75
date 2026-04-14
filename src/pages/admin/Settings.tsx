import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useSettingsData } from '@/hooks/useSettingsData';
import SettingsWarmingCard from '@/components/settings/SettingsWarmingCard';
import SettingsProtectionCard from '@/components/settings/SettingsProtectionCard';
import SettingsPhaseProgression from '@/components/settings/SettingsPhaseProgression';
import SettingsExternalNumbers from '@/components/settings/SettingsExternalNumbers';
import SettingsMessagesTab from '@/components/settings/SettingsMessagesTab';
import SupportChatSettings from '@/components/settings/SupportChatSettings';
import MessageSimulator from '@/components/admin/MessageSimulator';

export default function Settings() {
  const {
    isLoading, isSaving, settings, setSettings,
    messages, externalNumbers, connectedChips,
    showAllMessages, setShowAllMessages,
    newExternalPhone, setNewExternalPhone,
    newExternalName, setNewExternalName,
    csvInputRef,
    handleSaveSettings, handleCsvUpload, handleRemoveAllMessages,
    handleAddExternalNumber, handleDeleteExternalNumber, handleToggleExternalNumber,
  } = useSettingsData();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configurações do Sistema</h1>
          <p className="text-muted-foreground">Gerencie as regras de aquecimento, proteção anti-bloqueio e mensagens</p>
        </div>

        <Tabs defaultValue="config" className="space-y-6">
          <TabsList>
            <TabsTrigger value="config">Configurações</TabsTrigger>
            <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-6">
            {settings && (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <SettingsWarmingCard settings={settings} onChange={setSettings} />
                  <SettingsProtectionCard settings={settings} onChange={setSettings} />
                </div>

                <SettingsPhaseProgression settings={settings} onChange={setSettings} />

                <MessageSimulator settings={settings} chips={connectedChips} />

                {settings.warming_mode === 'external' && (
                  <SettingsExternalNumbers
                    externalNumbers={externalNumbers}
                    newPhone={newExternalPhone}
                    setNewPhone={setNewExternalPhone}
                    newName={newExternalName}
                    setNewName={setNewExternalName}
                    onAdd={handleAddExternalNumber}
                    onDelete={handleDeleteExternalNumber}
                    onToggle={handleToggleExternalNumber}
                  />
                )}

                <div className="flex justify-end">
                  <Button onClick={handleSaveSettings} size="lg" disabled={isSaving}>
                    {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : <><Save className="w-4 h-4 mr-2" />Salvar Configurações</>}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="mensagens">
            <SettingsMessagesTab
              messages={messages}
              showAllMessages={showAllMessages}
              setShowAllMessages={setShowAllMessages}
              csvInputRef={csvInputRef}
              onCsvUpload={handleCsvUpload}
              onRemoveAll={handleRemoveAllMessages}
              onSave={handleSaveSettings}
              isSaving={isSaving}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
