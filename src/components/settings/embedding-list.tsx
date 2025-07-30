import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { EmbeddingModal } from './embedding-modal';
import { useTranslations } from '@/i18n/hooks';

export interface EmbeddingModel {
  id: number | string;
  name: string;
  path: string;
  dimension?: number;
  description?: string;
  provider?: string;
  isDefault?: boolean;
}

async function fetchEmbeddings(): Promise<EmbeddingModel[]> {
  const res = await fetch('/api/embeddings');
  const data = await res.json();
  return data.map((m: any) => ({
    id: m.id,
    name: m.name,
    path: m.apiUrl,
    dimension: m.dimension,
    description: m.description,
    provider: m.provider,
    isDefault: m.is_default,
  }));
}

async function createEmbedding(model: EmbeddingModel) {
  const res = await fetch('/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: model.name,
      apiUrl: model.path,
      dimension: model.dimension || 384,
      description: model.description || '',
      provider: model.provider || 'ollama',
      is_default: model.isDefault || false,
    }),
  });
  return res.json();
}

async function updateEmbedding(model: EmbeddingModel) {
  await fetch(`/api/embeddings/${model.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: model.id,
      name: model.name,
      apiUrl: model.path,
      dimension: model.dimension || 384,
      description: model.description || '',
      provider: model.provider || 'ollama',
      is_default: model.isDefault || false,
    }),
  });
}

async function deleteEmbedding(id: number | string) {
  await fetch(`/api/embeddings/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
}

export function EmbeddingList() {
  const { t } = useTranslations();
  const [models, setModels] = useState<EmbeddingModel[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<EmbeddingModel | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchEmbeddings().then(ms => setModels(ms)).finally(() => setLoading(false));
  }, []);

  function handleAdd() {
    setEditingModel(null);
    setModalOpen(true);
  }

  function handleEdit(model: EmbeddingModel) {
    setEditingModel(model);
    setModalOpen(true);
  }

  async function handleDelete(id: number | string) {
    await deleteEmbedding(id);
    setModels(models => models.filter(m => m.id !== id));
    // Refresh page to ensure card status updates
    window.location.reload();
  }

  async function handleSave(model: EmbeddingModel) {
    if (editingModel) {
      await updateEmbedding(model);
      setModels(models => models.map(m => m.id === model.id ? model : m));
    } else {
      const res = await createEmbedding(model);
      setModels(models => [...models, { ...model, id: res.id }]);
    }
    setModalOpen(false);
    // Refresh page to ensure card status updates
    window.location.reload();
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">{t('pages.settings.vectorEmbeddingModelSettings')}</h2>
        <Button onClick={handleAdd}>{t('pages.settings.addEmbeddingModel')}</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="text-gray-400 text-sm col-span-full">{t('common.messages.loading')}</div>
        ) : models.length === 0 ? (
          <div className="text-gray-400 text-sm col-span-full">{t('pages.settings.noEmbeddingModels')}</div>
        ) : null}
        {models.map(model => (
          <Card key={model.id} className="p-4 h-32 flex flex-col group/card">
            <div>
              <div className="font-medium truncate" title={model.name}>
                {model.name}
              </div>
              <div className="text-xs text-gray-500 truncate mt-1">
                <span className="bg-gray-100 px-1.5 py-0.5 rounded mr-1">{model.provider === 'openai' ? 'OpenAI' : 'Ollama'}</span>
                <span title={model.path}>{model.path}</span>
              </div>
            </div>
            <div className="mt-auto flex justify-between items-center">
              <div>
                {model.isDefault && <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">{t('pages.settings.default')}</span>}
              </div>
              <div className="flex gap-2 opacity-0 pointer-events-none group-hover/card:opacity-100 group-hover/card:pointer-events-auto transition-opacity duration-200">
                <Button size="sm" variant="outline" onClick={() => handleEdit(model)} className="px-2 py-1 text-xs">{t('common.buttons.edit')}</Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(model.id)} className="px-2 py-1 text-xs">{t('common.buttons.delete')}</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <EmbeddingModal
        open={modalOpen}
        model={editingModel}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </section>
  );
} 