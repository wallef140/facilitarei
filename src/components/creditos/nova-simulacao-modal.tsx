'use client';

import { useState, Fragment, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, FileText } from 'lucide-react';
import { SimulacaoPDF } from './simulacao-pdf';
import { SimulacoesAPI } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { tabelaCredito } from '@/data/tabelaCredito';

interface NovaSimulacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function NovaSimulacaoModal({ isOpen, onClose, onSuccess }: NovaSimulacaoModalProps) {
  const [formData, setFormData] = useState({
    nomeCliente: '',
    cpf: '',
    consultor: '',
    valorSelecionado: 0,
  });

  const [loading, setLoading] = useState(false);
  const [simulacoes, setSimulacoes] = useState<any[]>([]);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [selectedSimulacao, setSelectedSimulacao] = useState<{
    numero: string;
    nome_cliente: string;
    cpf: string;
    consultor: string;
    valor_emprestimo: number;
    taxa_entrada: number;
    numero_parcelas: number;
    valor_entrada: number;
    valor_parcela: number;
    status: "Em Análise";
  } | null>(null);

  const valorSelecionado = tabelaCredito.find(item => item.credito === formData.valorSelecionado);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'valorSelecionado') {
      setFormData(prev => ({
        ...prev,
        [name]: Number(value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      if (!formData.nomeCliente?.trim()) {
        toast.error('Por favor, preencha o nome do cliente');
        setLoading(false);
        return;
      }

      if (!formData.valorSelecionado) {
        toast.error('Por favor, selecione um valor de crédito');
        setLoading(false);
        return;
      }

      const dadosCredito = tabelaCredito.find(item => item.credito === formData.valorSelecionado);
      
      if (!dadosCredito) {
        toast.error('Valor de crédito inválido');
        setLoading(false);
        return;
      }

      const novaSimulacao = {
        numero: await gerarNumeroSimulacao(),
        nome_cliente: formData.nomeCliente.trim(),
        cpf: formData.cpf,
        consultor: formData.consultor,
        valor_emprestimo: dadosCredito.credito,
        valor_entrada: dadosCredito.entrada,
        valor_parcela: dadosCredito.parcela,
        numero_parcelas: 240, // Alterado para exibir 240 parcelas
        taxa_entrada: Number(((dadosCredito.entrada / dadosCredito.credito) * 100).toFixed(2)),
        status: 'Em Análise' as const
      };

      // Adiciona à lista local de simulações
      setSimulacoes(prev => [...prev, novaSimulacao]);

      // Salva no Supabase
      const resultado = await SimulacoesAPI.criar(novaSimulacao);
      
      if (resultado) {
        toast.success('Simulação salva com sucesso!');
        
        setFormData({
          nomeCliente: '',
          cpf: '',
          consultor: '',
          valorSelecionado: 0,
        });
        
        if (onSuccess) {
          onSuccess();
        }
        
        onClose();
      }
    } catch (error) {
      console.error('Erro ao salvar simulação:', error);
      toast.error('Erro ao salvar simulação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const gerarNumeroSimulacao = () => {
    const ano = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-4); // Últimos 4 dígitos do timestamp
    const numeroAleatorio = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `SIM-${ano}-${timestamp}${numeroAleatorio}`;
  };

  const adicionarSimulacao = async () => {
    if (!formData.nomeCliente || !formData.valorSelecionado) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    const dadosCredito = tabelaCredito.find(item => item.credito === formData.valorSelecionado);
    
    if (!dadosCredito) {
      toast.error('Valor de crédito inválido');
      return;
    }

    const novaSimulacao = {
      numero: await gerarNumeroSimulacao(),
      nome_cliente: formData.nomeCliente,
      cpf: formData.cpf,
      consultor: formData.consultor,
      valor_emprestimo: dadosCredito.credito,
      taxa_entrada: Number(((dadosCredito.entrada / dadosCredito.credito) * 100).toFixed(2)),
      numero_parcelas: 240, // Alterado para exibir 240 parcelas
      valor_entrada: dadosCredito.entrada,
      valor_parcela: dadosCredito.parcela,
      status: 'Em Análise' as const
    };

    setSimulacoes([...simulacoes, novaSimulacao]);
    toast.success('Simulação adicionada à lista!');
    
    // Limpar apenas os campos de valor, mantendo os dados do cliente
    setFormData(prev => ({
      ...prev,
      valorSelecionado: 0,
    }));
  };

  const salvarTodasSimulacoes = async () => {
    if (!formData.nomeCliente || !formData.valorSelecionado) {
      // Se houver uma simulação em andamento, adiciona à lista primeiro
      if (formData.nomeCliente && formData.valorSelecionado) {
        await adicionarSimulacao();
      }
    }

    if (simulacoes.length === 0) {
      toast.error('Adicione pelo menos uma simulação antes de salvar');
      return;
    }

    setLoading(true);
    const erros: string[] = [];
    let simulacoesSalvas = 0;

    try {
      for (const simulacao of simulacoes) {
        try {
          // Garantir que todos os valores numéricos estão no formato correto
          const simulacaoFormatada = {
            ...simulacao,
            status: 'Em Análise' as const, // Garante que o status está correto
            valor_emprestimo: Number(simulacao.valor_emprestimo),
            taxa_entrada: Number(simulacao.taxa_entrada),
            numero_parcelas: Number(simulacao.numero_parcelas),
            valor_entrada: Number(simulacao.valor_entrada),
            valor_parcela: Number(simulacao.valor_parcela),
          };

          await SimulacoesAPI.criar(simulacaoFormatada);
          simulacoesSalvas++;
        } catch (error) {
          console.error('Erro ao salvar simulação:', error);
          if (error instanceof Error) {
            erros.push(`Erro ao salvar simulação ${simulacao.numero}: ${error.message}`);
          } else {
            erros.push(`Erro desconhecido ao salvar simulação ${simulacao.numero}`);
          }
        }
      }

      if (erros.length === 0) {
        toast.success('Todas as simulações foram salvas com sucesso!');
        setSimulacoes([]); // Limpa a lista após salvar
        
        // Limpar formulário
        setFormData({
          nomeCliente: '',
          cpf: '',
          consultor: '',
          valorSelecionado: 0,
        });
        
        onClose();
        onSuccess?.(); // Call onSuccess callback if provided
      } else {
        if (simulacoesSalvas > 0) {
          toast.success(`${simulacoesSalvas} simulações foram salvas com sucesso!`);
        }
        toast.error(`${erros.length} simulações não puderam ser salvas:`);
        erros.forEach(erro => toast.error(erro));
      }
    } catch (error) {
      console.error('Erro ao salvar simulações:', error);
      if (error instanceof Error) {
        toast.error(`Erro ao salvar simulações: ${error.message}`);
      } else {
        toast.error('Erro desconhecido ao salvar simulações');
      }
    } finally {
      setLoading(false);
    }
  };

  const removerSimulacao = (index: number) => {
    setSimulacoes(simulacoes.filter((_, i) => i !== index));
    toast.success('Simulação removida da lista');
  };

  const handleVisualizarPDF = () => {
    const simulacaoAtual = {
      numero: gerarNumeroSimulacao(),
      nome_cliente: formData.nomeCliente,
      cpf: formData.cpf,
      consultor: formData.consultor,
      valor_emprestimo: valorSelecionado?.credito,
      taxa_entrada: Number(((valorSelecionado?.entrada / valorSelecionado?.credito) * 100).toFixed(2)),
      numero_parcelas: 240, // Alterado para exibir 240 parcelas
      valor_entrada: valorSelecionado?.entrada,
      valor_parcela: valorSelecionado?.parcela,
      status: 'Em Análise' as const
    };

    setSelectedSimulacao(simulacaoAtual);
    setIsPDFModalOpen(true);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <div className="fixed inset-0">
            <div className="fixed inset-0 bg-gradient-to-br from-white/10 via-black/20 to-black/30 backdrop-blur-[2px]" aria-hidden="true" />
          </div>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-lg bg-gradient-to-b from-white/70 to-white/50 dark:from-gray-900/70 dark:to-gray-900/50 text-left shadow-xl transition-all backdrop-blur-sm">
              <div className="flex h-full flex-col">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
                      Nova Simulação
                    </Dialog.Title>
                    <button
                      onClick={onClose}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  <form 
                    id="simulacaoForm"
                    onSubmit={(e) => {
                      e.preventDefault();
                      console.log("Formulário submetido");
                      handleSubmit();
                    }} 
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="nomeCliente" className="block text-sm font-medium bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                          Nome do Cliente
                        </label>
                        <input
                          type="text"
                          name="nomeCliente"
                          id="nomeCliente"
                          required
                          value={formData.nomeCliente}
                          onChange={handleChange}
                          className="mt-1 block w-full rounded-md bg-white/40 dark:bg-gray-700/40 border border-white/60 dark:border-gray-600/60 shadow-sm focus:border-indigo-500 dark:focus:border-orange-500 focus:ring-indigo-500 dark:focus:ring-orange-500 sm:text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 backdrop-blur-sm transition-all duration-200"
                        />
                      </div>

                      <div>
                        <label htmlFor="cpf" className="block text-sm font-medium bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                          CPF
                        </label>
                        <input
                          type="text"
                          name="cpf"
                          id="cpf"
                          required
                          value={formData.cpf}
                          onChange={handleChange}
                          className="mt-1 block w-full rounded-md bg-white/40 dark:bg-gray-700/40 border border-white/60 dark:border-gray-600/60 shadow-sm focus:border-indigo-500 dark:focus:border-orange-500 focus:ring-indigo-500 dark:focus:ring-orange-500 sm:text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 backdrop-blur-sm transition-all duration-200"
                        />
                      </div>

                      <div>
                        <label htmlFor="consultor" className="block text-sm font-medium bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                          Consultor
                        </label>
                        <input
                          type="text"
                          name="consultor"
                          id="consultor"
                          required
                          value={formData.consultor}
                          onChange={handleChange}
                          className="mt-1 block w-full rounded-md bg-white/40 dark:bg-gray-700/40 border border-white/60 dark:border-gray-600/60 shadow-sm focus:border-indigo-500 dark:focus:border-orange-500 focus:ring-indigo-500 dark:focus:ring-orange-500 sm:text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 backdrop-blur-sm transition-all duration-200"
                        />
                      </div>

                      <div>
                        <label htmlFor="valorSelecionado" className="block text-sm font-medium bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                          Valor do Crédito
                        </label>
                        <select
                          id="valorSelecionado"
                          name="valorSelecionado"
                          required
                          value={formData.valorSelecionado}
                          onChange={handleChange}
                          className="mt-1 block w-full rounded-md bg-white/40 dark:bg-gray-700/40 border border-white/60 dark:border-gray-600/60 shadow-sm focus:border-indigo-500 dark:focus:border-orange-500 focus:ring-indigo-500 dark:focus:ring-orange-500 sm:text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 backdrop-blur-sm transition-all duration-200"
                        >
                          <option value="">Selecione um valor de crédito</option>
                          {tabelaCredito.map(item => (
                            <option key={item.credito} value={item.credito}>{item.credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {formData.valorSelecionado && (
                      <div className="rounded-lg bg-gradient-to-br from-white/40 to-white/20 dark:from-gray-800/40 dark:to-gray-800/20 p-6 backdrop-blur-sm shadow-xl">
                        <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent mb-4">
                          Resultado da Simulação
                        </h3>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-3">
                              <div>
                                <span className="text-sm text-gray-600 dark:text-gray-300">Valor do Bem</span>
                                <p className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                                  R$ {valorSelecionado?.credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div>
                                <span className="text-sm text-gray-600 dark:text-gray-300">Entrada</span>
                                <p className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                                  R$ {valorSelecionado?.entrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <span className="text-sm text-gray-600 dark:text-gray-300">Parcelas</span>
                                <p className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                                  240x de R$ {valorSelecionado?.parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div>
                                <span className="text-sm text-gray-600 dark:text-gray-300">Taxa de Entrada</span>
                                <p className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                                  {Number(((valorSelecionado?.entrada / valorSelecionado?.credito) * 100).toFixed(2))}%
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-center gap-2">
                            <button
                              type="button"
                              className="flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              onClick={() => {
                                setIsPDFModalOpen(true);
                              }}
                            >
                              <FileText className="h-4 w-4" />
                              Visualizar PDF
                            </button>
                            <button
                              type="button"
                              className="flex items-center justify-center gap-1 px-3 py-1.5 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                              onClick={adicionarSimulacao}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4"
                              >
                                <path d="M5 12h14" />
                                <path d="M12 5v14" />
                              </svg>
                              Adicionar à Lista
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {simulacoes.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Simulações Adicionadas:</h3>
                        <div className="space-y-2 mb-4">
                          {simulacoes.map((simulacao, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-lg"
                            >
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">Simulação {index + 1}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                  Valor: R$ {simulacao.valor_emprestimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                  Parcelas: {simulacao.numero_parcelas}x de R$ {simulacao.valor_parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              <button
                                onClick={() => removerSimulacao(index)}
                                className="text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-400"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-center">
                          <button
                            type="button"
                            className="flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onClick={() => {
                              setIsPDFModalOpen(true);
                            }}
                          >
                            <FileText className="h-4 w-4" />
                            Visualizar PDF
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                </div>

                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      console.log("Botão salvar clicado");
                      handleSubmit();
                    }}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-orange-500 border border-transparent rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      <Transition appear show={isPDFModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setIsPDFModalOpen(false)}>
          <div className="fixed inset-0" onClick={(e) => e.stopPropagation()}>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
          </div>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-4xl h-[90vh] bg-gradient-to-b from-gray-900/70 to-gray-900/50 backdrop-blur-sm rounded-lg shadow-xl">
              <div className="h-full flex flex-col">
                <div className="flex justify-between items-center px-4 py-3 border-b border-gray-700">
                  <Dialog.Title className="text-lg font-medium text-white">
                    Visualizar PDF
                  </Dialog.Title>
                  <button
                    onClick={() => setIsPDFModalOpen(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <SimulacaoPDF
                  simulacoes={simulacoes.length > 0 ? simulacoes : valorSelecionado ? [{
                    numero: '',
                    nome_cliente: formData.nomeCliente,
                    cpf: formData.cpf,
                    consultor: formData.consultor,
                    valor_emprestimo: valorSelecionado.credito,
                    valor_entrada: valorSelecionado.entrada,
                    valor_parcela: valorSelecionado.parcela,
                    numero_parcelas: 240,
                    taxa_entrada: Number(((valorSelecionado.entrada / valorSelecionado.credito) * 100).toFixed(2)),
                    status: 'Em Análise' as const
                  }] : []}
                  dadosCliente={{
                    nome_cliente: formData.nomeCliente,
                    cpf: formData.cpf,
                    consultor: formData.consultor
                  }}
                />
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}