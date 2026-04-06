import React, { useState } from 'react';
import { User, Mail, Phone, MapPin, Calendar, FileText, Upload, AlertCircle } from 'lucide-react';

interface FormData {
  // Dados do Responsável
  nomeResponsavel: string;
  cpfResponsavel: string;
  cepResponsavel: string;
  enderecoResponsavel: string;
  celularResponsavel: string;
  
  // Dados do Aluno
  nomeAluno: string;
  dataNascimento: string;
  cpfAluno: string;
  cepAluno: string;
  enderecoAluno: string;
  nomePai: string;
  nomeMae: string;
  
  // Documentos
  documentos: File[];
}

const Matricula = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    nomeResponsavel: '',
    cpfResponsavel: '',
    cepResponsavel: '',
    enderecoResponsavel: '',
    celularResponsavel: '',
    nomeAluno: '',
    dataNascimento: '',
    cpfAluno: '',
    cepAluno: '',
    enderecoAluno: '',
    nomePai: '',
    nomeMae: '',
    documentos: []
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      const validSize = file.size <= 5 * 1024 * 1024; // 5MB
      return validTypes.includes(file.type) && validSize;
    });

    setFormData(prev => ({
      ...prev,
      documentos: [...prev.documentos, ...validFiles]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log('Form submitted:', formData);
  };

  const tabs = [
    { id: 0, title: 'Dados do Responsável' },
    { id: 1, title: 'Dados do Aluno' },
    { id: 2, title: 'Documentação' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-[#003876] mb-4">Matrícula 2025</h1>
            <p className="text-gray-600 mb-6">
              A inscrição deve ser feita por um responsável legal do estudante.
            </p>
            <div className="bg-blue-50 p-4 rounded-lg text-sm text-[#003876]">
              <h2 className="font-semibold mb-2">Para agilizar o preenchimento do cadastro, tenha em mãos:</h2>
              <ul className="list-disc list-inside space-y-1 text-left">
                <li>Certidão de Nascimento do candidato</li>
                <li>Declaração de Escolaridade da escola de origem</li>
                <li>Cópia do Boletim Final de 2023 e Boletim Parcial de 2024</li>
              </ul>
              <p className="mt-4 text-xs">
                Tamanho máximo de cada arquivo: 5 Mb<br />
                Extensões compatíveis: .jpg, .jpeg, .png, .pdf
              </p>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex mb-8">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 text-center relative ${
                  activeTab === tab.id
                    ? 'text-[#003876] font-semibold'
                    : 'text-gray-500'
                }`}
              >
                <span className="relative z-10">{tab.title}</span>
                <div
                  className={`absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-300 ${
                    activeTab === tab.id ? 'bg-[#003876]' : 'bg-gray-200'
                  }`}
                />
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8">
            {/* Dados do Responsável */}
            <div className={activeTab === 0 ? 'block' : 'hidden'}>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome completo do responsável *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="nomeResponsavel"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#003876] focus:border-transparent"
                      value={formData.nomeResponsavel}
                      onChange={handleInputChange}
                    />
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CPF *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="cpfResponsavel"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#003876] focus:border-transparent"
                      value={formData.cpfResponsavel}
                      onChange={handleInputChange}
                    />
                    <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CEP *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="cepResponsavel"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#003876] focus:border-transparent"
                      value={formData.cepResponsavel}
                      onChange={handleInputChange}
                    />
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endereço completo *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="enderecoResponsavel"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#003876] focus:border-transparent"
                      value={formData.enderecoResponsavel}
                      onChange={handleInputChange}
                    />
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Celular *
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      name="celularResponsavel"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#003876] focus:border-transparent"
                      value={formData.celularResponsavel}
                      onChange={handleInputChange}
                    />
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Dados do Aluno */}
            <div className={activeTab === 1 ? 'block' : 'hidden'}>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome completo do aluno *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="nomeAluno"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#003876] focus:border-transparent"
                      value={formData.nomeAluno}
                      onChange={handleInputChange}
                    />
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data de Nascimento *
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      name="dataNascimento"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#003876] focus:border-transparent"
                      value={formData.dataNascimento}
                      onChange={handleInputChange}
                    />
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CPF (se houver)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="cpfAluno"
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#003876] focus:border-transparent"
                      value={formData.cpfAluno}
                      onChange={handleInputChange}
                    />
                    <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CEP *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="cepAluno"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#003876] focus:border-transparent"
                      value={formData.cepAluno}
                      onChange={handleInputChange}
                    />
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endereço completo *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="enderecoAluno"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#003876] focus:border-transparent"
                      value={formData.enderecoAluno}
                      onChange={handleInputChange}
                    />
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Pai
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="nomePai"
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#003876] focus:border-transparent"
                      value={formData.nomePai}
                      onChange={handleInputChange}
                    />
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome da Mãe *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="nomeMae"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#003876] focus:border-transparent"
                      value={formData.nomeMae}
                      onChange={handleInputChange}
                    />
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Documentação */}
            <div className={activeTab === 2 ? 'block' : 'hidden'}>
              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg mb-6">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-[#003876] mt-0.5 mr-2" />
                    <div className="text-sm text-[#003876]">
                      <p className="font-semibold">Documentos necessários:</p>
                      <ul className="list-disc list-inside mt-2">
                        <li>Certidão de Nascimento do Aluno</li>
                        <li>Declaração provisória ou histórico escolar</li>
                        <li>RG do responsável</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <label className="block">
                        <span className="sr-only">Escolher arquivos</span>
                        <input
                          type="file"
                          className="block w-full text-sm text-gray-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-full file:border-0
                            file:text-sm file:font-semibold
                            file:bg-[#003876] file:text-white
                            hover:file:bg-[#002855]
                            cursor-pointer"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleFileChange}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Arraste e solte os arquivos aqui ou clique para selecionar
                    </p>
                  </div>
                </div>

                {formData.documentos.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-medium text-gray-900 mb-2">Arquivos selecionados:</h3>
                    <ul className="space-y-2">
                      {formData.documentos.map((file, index) => (
                        <li key={index} className="flex items-center text-sm text-gray-600">
                          <FileText className="w-4 h-4 mr-2" />
                          {file.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="mt-8 flex justify-between">
              {activeTab > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab - 1)}
                  className="px-6 py-2 text-[#003876] font-medium hover:text-[#002855] transition-colors"
                >
                  Voltar
                </button>
              )}
              {activeTab < tabs.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab + 1)}
                  className="ml-auto bg-[#003876] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#002855] transition-colors"
                >
                  Próximo
                </button>
              ) : (
                <button
                  type="submit"
                  className="ml-auto bg-[#003876] text-white px-8 py-3 rounded-lg font-medium hover:bg-[#002855] transition-colors flex items-center"
                >
                  Enviar Inscrição
                  <FileText className="ml-2 w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Matricula;