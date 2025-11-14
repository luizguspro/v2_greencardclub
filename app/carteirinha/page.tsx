"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import { motion } from "framer-motion";
import { ArrowLeft, User, Camera, Check, FileText, Download, Eye, Shield, AlertCircle, Printer } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

// =================== TIPOS E INTERFACES ===================
interface FormData {
  name: string;
  nickname?: string;
  cpf: string;
  birthDate: string; // Este campo será mantido como YYYY-MM-DD internamente
  nationality: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  bloodType?: string;
  allergies?: string;
  emergencyContact?: string;
  medicalCondition?: string;
  doctorName?: string;
  crmNumber?: string;
  state?: string;
}

interface FormErrors {
  [key: string]: string;
}

// =================== CONFIGURAÇÕES DO CARTÃO ===================
const CARD_PRINT_CONFIG = {
  widthMM: 85.6,
  heightMM: 54,
  widthPX: 1013,
  heightPX: 638,
  dpi: 300
};

const CARD_FIELDS = {
  basicInfo: ['name', 'nickname', 'age', 'cardNumber', 'validity', 'nationality'],
  medicalInfo: ['medicalCondition', 'bloodType', 'allergies'],
  doctorInfo: ['doctorName', 'crmNumber'],
  contactInfo: ['phone', 'emergencyContact'],
  qrCode: true,
  photo: true,
  logo: true
};

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// =================== UTILITÁRIOS ===================
const formatCPF = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 11) {
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{2})/, '$1-$2');
  }
  return value;
};

const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 11) {
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  }
  return value;
};

const validateCPF = (cpf: string): boolean => {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;
  
  let sum = 0;
  let remainder;
  
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;
  
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;
  
  return true;
};

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const calculateAge = (birthDateString: string): string => {
  // Formato esperado: YYYY-MM-DD
  if (!birthDateString || !/^\d{4}-\d{2}-\d{2}$/.test(birthDateString)) return "--";
  const [year, month, day] = birthDateString.split('-').map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age.toString();
};

// NOVA FUNÇÃO UTILITÁRIA PARA EXIBIÇÃO
const formatDateForDisplay = (dateString: string): string => {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return "---";
  const [year, month, day] = dateString.split('-');
  if (!day || !month || !year) return "---";
  return `${day}/${month}/${year}`;
};

const generateCardNumber = (): string => {
  return `GC${Date.now().toString().slice(-8)}`;
};

const generatePassword = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// =================== COMPONENTE DO CARTÃO CORRIGIDO ===================
interface CardProps {
  formData: FormData;
  selectedImage: string | null;
  cardNumber: string;
  forExport?: boolean;
}

const MedicalCard: React.FC<CardProps> = ({ 
  formData, 
  selectedImage, 
  cardNumber,
  forExport = false
}) => {
  const qrCodeValue = `https://greencard.club/verify/${cardNumber}`;
  const bgColor = "#105740";
  
  // Estilos inline para exportação (mais confiável)
  const cardStyle = forExport ? {
    width: '350px',
    height: '220px',
    borderRadius: '16px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    background: bgColor,
    position: 'relative' as const
  } : {};

  return (
    <div 
      className={!forExport ? "w-[350px] h-[220px] rounded-2xl shadow-2xl overflow-hidden relative" : ""}
      style={forExport ? cardStyle : { background: bgColor, position: 'relative' }}
    >
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="w-full h-full" 
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 40px,
              rgba(0,0,0,.02) 40px,
              rgba(0,0,0,.02) 80px
            )`
          }}
        />
      </div>

      <div className="relative z-10 p-4 h-full flex flex-col" style={forExport ? { padding: '16px', height: '100%', display: 'flex', flexDirection: 'column' } : {}}>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
            <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.8)' }}>
              GREENCARDCLUB
            </span>
          </div>
          <div className="text-right">
            <p className="text-[7px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Registro</p>
            <p className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.7)' }}>{cardNumber}</p>
          </div>
        </div>

        <div className="flex gap-3 flex-1">
          {CARD_FIELDS.photo && (
            <div className="flex flex-col">
              <div className="w-[75px] h-[90px] rounded-lg overflow-hidden border shadow-inner" 
                style={{ 
                  background: 'linear-gradient(to bottom right, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                  borderColor: 'rgba(255,255,255,0.25)'
                }}>
                {selectedImage ? (
                  <img src={selectedImage} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <User className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.25)' }} />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col">
            <div className="mb-2.5">
              <p className="font-bold text-[15px] leading-tight tracking-wide" style={{ color: 'white' }}>
                {formData.name.toUpperCase() || "NOME DO PACIENTE"}
              </p>
              {formData.nickname && (
                <p className="text-[10px] mt-0.5 italic" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {`"${formData.nickname}"`}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
              <div>
                <p className="text-[7px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Idade</p>
                <p className="font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  {calculateAge(formData.birthDate)} anos
                </p>
              </div>
              
              <div>
                <p className="text-[7px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Nacionalidade</p>
                <p className="font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  {formData.nationality === 'brasileiro' ? 'Brasileiro' : formData.nationality || 'Brasileiro'}
                </p>
              </div>
              
              {formData.state && (
                <div>
                  <p className="text-[7px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>UF</p>
                  <p className="font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                    {formData.state}
                  </p>
                </div>
              )}
              
              <div>
                <p className="text-[7px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Validade</p>
                <p className="text-[11px] font-bold" style={{ color: 'white' }}>12/2026</p>
              </div>
            </div>

            {formData.bloodType && (
              <div className="mt-2">
                <p className="text-[7px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Tipo Sanguíneo</p>
                <p className="font-bold text-[10px]" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  {formData.bloodType}
                </p>
              </div>
            )}

            {formData.medicalCondition && (
              <div className="mt-2">
                <p className="text-[7px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Condição Autorizada</p>
                <p className="text-[10px] font-semibold" style={{ color: 'rgba(110, 231, 183, 0.9)' }}>
                  {formData.medicalCondition}
                </p>
              </div>
            )}
          </div>

          {CARD_FIELDS.qrCode && (
            <div className="flex flex-col items-end justify-between">
              <div className="p-1 rounded-md shadow-sm" style={{ backgroundColor: 'white' }}>
                <QRCodeCanvas
                  value={qrCodeValue}
                  size={44}
                  bgColor="#ffffff"
                  fgColor="#063d2b"
                  level={"M"}
                  includeMargin={false}
                />
              </div>
              <div className="text-right">
                <p className="text-[6px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  greencardcannabico
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-1.5 mt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2">
            {!forExport && (
              <Image
                src="/planta.svg"
                alt="Cannabis"
                width={14}
                height={14}
                className="opacity-30 brightness-0 invert"
              />
            )}
            <p className="text-[6px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Documento Digital
            </p>
          </div>
          <p className="text-[6px]" style={{ color: 'rgba(255,255,255,0.4)' }}>© 2025</p>
        </div>
      </div>
    </div>
  );
};

// =================== COMPONENTE DE NOTIFICAÇÃO ===================
interface NotificationProps {
  message: string;
  type: 'success' | 'error' | 'warning';
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500'
  }[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50`}
    >
      <AlertCircle className="w-5 h-5" />
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 text-xl font-bold">×</button>
    </motion.div>
  );
};

// =================== COMPONENTE PRINCIPAL ===================
export default function CarterinhaPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  
  const [formData, setFormData] = useState<FormData>({
    name: "",
    nickname: "",
    cpf: "",
    birthDate: "", // Mantém o formato YYYY-MM-DD
    nationality: "brasileiro",
    state: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    bloodType: "",
    allergies: "",
    emergencyContact: "",
    medicalCondition: "",
    doctorName: "",
    crmNumber: ""
  });

  // === NOVOS ESTADOS PARA DATA DE NASCIMENTO ===
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  // ==========================================

  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const hiddenCardRef = useRef<HTMLDivElement>(null); // Ref para o cartão oculto
  const cardNumber = useMemo(() => generateCardNumber(), []);

  // === NOVOS ARRAYS PARA DATA DE NASCIMENTO ===
  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')), []);
  const months = useMemo(() => [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ], []);
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    // Gera uma lista de 100 anos para trás
    return Array.from({ length: 100 }, (_, i) => String(currentYear - i));
  }, []);
  // ============================================

  const steps = [
    { id: 1, name: "Dados Pessoais", icon: User },
    { id: 2, name: "Dados Médicos", icon: FileText },
    { id: 3, name: "Sua Foto", icon: Camera },
    { id: 4, name: "Revisão", icon: Check },
    { id: 5, name: "Carteirinha", icon: Check },
  ];

  const validateStep = (step: number): boolean => {
    const newErrors: FormErrors = {};
    
    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = "Nome é obrigatório";
      if (!validateCPF(formData.cpf)) newErrors.cpf = "CPF inválido";
      // A validação continua a mesma, pois formData.birthDate só é preenchido se os 3 campos estiverem ok
      if (!formData.birthDate) newErrors.birthDate = "Data de nascimento é obrigatória";
      if (!formData.nationality) newErrors.nationality = "Nacionalidade é obrigatória";
      if (!formData.phone.trim()) newErrors.phone = "Telefone é obrigatório";
      if (!validateEmail(formData.email)) newErrors.email = "Email inválido";
      if (formData.password.length < 6) newErrors.password = "Senha deve ter pelo menos 6 caracteres";
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Senhas não conferem";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStep(1)) {
      setNotification({ message: "Por favor, corrija os erros no formulário", type: "warning" });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    let formattedValue = value;
    
    if (field === 'cpf') {
      formattedValue = formatCPF(value);
    } else if (field === 'phone' || field === 'emergencyContact') {
      formattedValue = formatPhone(value);
    }
    
    setFormData({ ...formData, [field]: formattedValue });
    
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  // === NOVO HANDLER PARA DATA DE NASCIMENTO ===
  const handleBirthDateChange = (part: 'day' | 'month' | 'year', value: string) => {
    let newDay = birthDay;
    let newMonth = birthMonth;
    let newYear = birthYear;

    if (part === 'day') {
      setBirthDay(value);
      newDay = value;
    } else if (part === 'month') {
      setBirthMonth(value);
      newMonth = value;
    } else if (part === 'year') {
      setBirthYear(value);
      newYear = value;
    }

    // Tenta montar a data YYYY-MM-DD
    if (newDay && newMonth && newYear) {
      const dateString = `${newYear}-${newMonth}-${newDay}`;
      
      // Atualiza o formData principal
      handleInputChange('birthDate', dateString);
    } else {
      // Se qualquer parte estiver faltando, limpa a data no formData
      handleInputChange('birthDate', '');
    }
  };
  // ============================================

  const handleImageUpload = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setNotification({ message: "Imagem deve ter menos de 5MB", type: "error" });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Função para download PDF CORRIGIDA
  const handleDownloadPDF = useCallback(async () => {
    setIsGeneratingPDF(true);
    setNotification({ message: "Gerando PDF...", type: "warning" });

    try {
      // Aguarda renderização completa
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const element = hiddenCardRef.current;
      if (!element) throw new Error("Erro ao renderizar cartão");
      
      // Captura com configurações otimizadas
      const dataUrl = await htmlToImage.toPng(element, {
        cacheBust: true,
        pixelRatio: 3,
        quality: 1,
        backgroundColor: '#ffffff',
        width: 350,
        height: 220
      });

      // Cria o PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [CARD_PRINT_CONFIG.heightMM, CARD_PRINT_CONFIG.widthMM]
      });

      pdf.addImage(
        dataUrl, 
        'PNG', 
        0, 
        0, 
        CARD_PRINT_CONFIG.widthMM, 
        CARD_PRINT_CONFIG.heightMM,
        undefined,
        'FAST'
      );

      pdf.save(`carteirinha-${formData.name.split(' ')[0] || 'usuario'}-${cardNumber}.pdf`);
      
      setNotification({ 
        message: "PDF gerado com sucesso!", 
        type: "success" 
      });
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      setNotification({ message: "Erro ao gerar PDF. Tente novamente.", type: "error" });
    } finally {
      setIsGeneratingPDF(false);
      setTimeout(() => setNotification(null), 5000);
    }
  }, [formData.name, cardNumber]);

  // Função para download PNG CORRIGIDA
  const handleDownloadPNG = useCallback(async () => {
    try {
      setNotification({ message: "Gerando imagem...", type: "warning" });
      
      // Aguarda renderização completa
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const element = hiddenCardRef.current;
      if (!element) throw new Error("Erro ao renderizar cartão");
      
      const dataUrl = await htmlToImage.toPng(element, {
        cacheBust: true,
        pixelRatio: 3,
        quality: 0.95,
        backgroundColor: '#ffffff',
        width: 350,
        height: 220
      });
      
      const link = document.createElement('a');
      link.download = `carteirinha-${formData.name.split(' ')[0] || 'usuario'}-${cardNumber}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setNotification({ message: "Imagem baixada com sucesso!", type: "success" });
    } catch (err) {
      console.error('Erro ao gerar imagem:', err);
      setNotification({ message: "Erro ao baixar imagem. Tente novamente.", type: "error" });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  }, [formData.name, cardNumber]);

  const handleFinalize = async () => {
    setIsLoading(true);
    try {
      const finalPassword = formData.password || generatePassword();
      
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...formData, 
          password: finalPassword,
          cardNumber
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        const cardRes = await fetch('/api/cards/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId: data.id, 
            photoUrl: selectedImage,
            cardNumber,
            additionalData: {
              nickname: formData.nickname,
              nationality: formData.nationality,
              state: formData.state,
              bloodType: formData.bloodType,
              allergies: formData.allergies,
              emergencyContact: formData.emergencyContact,
              medicalCondition: formData.medicalCondition,
              doctorName: formData.doctorName,
              crmNumber: formData.crmNumber
            }
          })
        });
        
        if (cardRes.ok) {
          setCurrentStep(5);
          setNotification({ message: "Cadastro realizado com sucesso!", type: "success" });
        } else {
          throw new Error('Erro ao criar carteirinha');
        }
      } else {
        throw new Error(data.error || 'Erro ao criar usuário');
      }
    } catch (error) {
      console.error(error);
      setNotification({ message: error instanceof Error ? error.message : "Erro na conexão", type: "error" });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-greencard-background via-white to-greencard-tertiary/10">
      {/* Notificações */}
      {notification && (
        <Notification 
          message={notification.message} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}

      {/* Cartão oculto para exportação - SEMPRE RENDERIZADO */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={hiddenCardRef}>
          <MedicalCard
            formData={formData}
            selectedImage={selectedImage}
            cardNumber={cardNumber}
            forExport={true}
          />
        </div>
      </div>
      
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-greencard-tertiary/20">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link 
              href="/"
              className="flex items-center gap-1 sm:gap-2 text-greencard-primary hover:text-greencard-secondary transition-colors"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base font-semibold">Voltar ao início</span>
            </Link>
            <div className="text-sm text-gray-600">
              ID: <span className="font-mono font-bold">{cardNumber}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-12 max-w-4xl">
        {/* Progress Steps */}
        <div className="mb-8 sm:mb-10 md:mb-12">
          <div className="flex justify-between items-center">
            {steps.map((step, index) => (
              <div key={step.id} className="flex-1 relative">
                {index < steps.length - 1 && (
                  <div
                    className={`absolute top-5 sm:top-6 md:top-8 left-1/2 w-full h-0.5 sm:h-1 ${
                      currentStep > step.id ? "bg-greencard-primary" : "bg-gray-200"
                    }`}
                  />
                )}
                <div className="flex flex-col items-center relative z-10">
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: currentStep >= step.id ? 1 : 0.8 }}
                    className={`w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center font-bold text-sm sm:text-base md:text-lg transition-all ${
                      currentStep >= step.id
                        ? "bg-greencard-primary text-white shadow-lg"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
                    ) : (
                      <span className="text-xs sm:text-sm md:text-base">{step.id}</span>
                    )}
                  </motion.div>
                  <span className={`text-xs sm:text-sm mt-1 sm:mt-2 font-medium text-center ${
                    currentStep >= step.id ? "text-greencard-primary" : "text-gray-500"
                  } ${index <= 2 ? 'hidden sm:block' : ''}`}>
                    {step.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl p-4 sm:p-6 md:p-8"
        >
          {/* PASSO 1: DADOS PESSOAIS */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-greencard-primary mb-2">
                Dados Pessoais
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
                Informações básicas para seu cadastro
              </p>
              
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-greencard-primary mb-1 sm:mb-2">
                      Nome completo *
                    </label>
                    <input
                      type="text"
                      className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 rounded-lg sm:rounded-xl focus:outline-none transition-colors ${
                        errors.name ? 'border-red-500 focus:border-red-600' : 'border-gray-200 focus:border-greencard-primary'
                      }`}
                      placeholder="Digite seu nome completo"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                    />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-greencard-primary mb-1 sm:mb-2">
                      Apelido (opcional)
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg sm:rounded-xl focus:border-greencard-primary focus:outline-none transition-colors"
                      placeholder="Como prefere ser chamado"
                      value={formData.nickname}
                      onChange={(e) => handleInputChange('nickname', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-greencard-primary mb-1 sm:mb-2">
                    CPF *
                  </label>
                  <input
                    type="text"
                    className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 rounded-lg sm:rounded-xl focus:outline-none transition-colors ${
                      errors.cpf ? 'border-red-500 focus:border-red-600' : 'border-gray-200 focus:border-greencard-primary'
                    }`}
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={(e) => handleInputChange('cpf', e.target.value)}
                    maxLength={14}
                  />
                  {errors.cpf && <p className="text-red-500 text-xs mt-1">{errors.cpf}</p>}
                </div>

                {/* ============================================================== */}
                {/* === BLOCO DA DATA DE NASCIMENTO SUBSTITUÍDO === */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-greencard-primary mb-1 sm:mb-2">
                    Data de nascimento *
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {/* DIA */}
                    <select
                      value={birthDay}
                      onChange={(e) => handleBirthDateChange('day', e.target.value)}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 rounded-lg sm:rounded-xl focus:outline-none transition-colors ${
                        errors.birthDate ? 'border-red-500 focus:border-red-600' : 'border-gray-200 focus:border-greencard-primary'
                      }`}
                    >
                      <option value="">Dia</option>
                      {days.map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                    
                    {/* MÊS */}
                    <select
                      value={birthMonth}
                      onChange={(e) => handleBirthDateChange('month', e.target.value)}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 rounded-lg sm:rounded-xl focus:outline-none transition-colors ${
                        errors.birthDate ? 'border-red-500 focus:border-red-600' : 'border-gray-200 focus:border-greencard-primary'
                      }`}
                    >
                      <option value="">Mês</option>
                      {months.map(month => (
                        <option key={month.value} value={month.value}>{month.label}</option>
                      ))}
                    </select>

                    {/* ANO */}
                    <select
                      value={birthYear}
                      onChange={(e) => handleBirthDateChange('year', e.target.value)}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 rounded-lg sm:rounded-xl focus:outline-none transition-colors ${
                        errors.birthDate ? 'border-red-500 focus:border-red-600' : 'border-gray-200 focus:border-greencard-primary'
                      }`}
                    >
                      <option value="">Ano</option>
                      {years.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  {errors.birthDate && <p className="text-red-500 text-xs mt-1">{errors.birthDate}</p>}
                </div>
                {/* ============================================================== */}


                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-greencard-primary mb-1 sm:mb-2">
                      Nacionalidade *
                    </label>
                    <select
                      className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 rounded-lg sm:rounded-xl focus:outline-none transition-colors ${
                        errors.nationality ? 'border-red-500 focus:border-red-600' : 'border-gray-200 focus:border-greencard-primary'
                      }`}
                      value={formData.nationality}
                      onChange={(e) => handleInputChange('nationality', e.target.value)}
                    >
                      <option value="brasileiro">Brasileiro</option>
                      <option value="estrangeiro">Estrangeiro</option>
                    </select>
                    {errors.nationality && <p className="text-red-500 text-xs mt-1">{errors.nationality}</p>}
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-greencard-primary mb-1 sm:mb-2">
                      Estado (UF)
                    </label>
                    <select
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg sm:rounded-xl focus:border-greencard-primary focus:outline-none transition-colors"
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {ESTADOS_BRASIL.map(estado => (
                        <option key={estado} value={estado}>{estado}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-greencard-primary mb-1 sm:mb-2">
                      Telefone *
                    </label>
                    <input
                      type="tel"
                      className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 rounded-lg sm:rounded-xl focus:outline-none transition-colors ${
                        errors.phone ? 'border-red-500 focus:border-red-600' : 'border-gray-200 focus:border-greencard-primary'
                      }`}
                      placeholder="(00) 00000-0000"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      maxLength={15}
                    />
                    {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-greencard-primary mb-1 sm:mb-2">
                      E-mail *
                    </label>
                    <input
                      type="email"
                      className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 rounded-lg sm:rounded-xl focus:outline-none transition-colors ${
                        errors.email ? 'border-red-500 focus:border-red-600' : 'border-gray-200 focus:border-greencard-primary'
                      }`}
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                    />
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-greencard-primary mb-1 sm:mb-2">
                      Senha *
                    </label>
                    <input
                      type="password"
                      className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 rounded-lg sm:rounded-xl focus:outline-none transition-colors ${
                        errors.password ? 'border-red-500 focus:border-red-600' : 'border-gray-200 focus:border-greencard-primary'
                      }`}
                      placeholder="Mínimo 6 caracteres"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                    />
                    {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-greencard-primary mb-1 sm:mb-2">
                      Confirmar Senha *
                    </label>
                    <input
                      type="password"
                      className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 rounded-lg sm:rounded-xl focus:outline-none transition-colors ${
                        errors.confirmPassword ? 'border-red-500 focus:border-red-600' : 'border-gray-200 focus:border-greencard-primary'
                      }`}
                      placeholder="Digite a senha novamente"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    />
                    {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 2: DADOS MÉDICOS */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-greencard-primary mb-2">
                Dados Médicos
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
                Informações opcionais para personalizar sua carteirinha
              </p>
              
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-greencard-primary mb-1 sm:mb-2">
                      Tipo Sanguíneo
                    </label>
                    <select
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg sm:rounded-xl focus:border-greencard-primary focus:outline-none transition-colors"
                      value={formData.bloodType}
                      onChange={(e) => handleInputChange('bloodType', e.target.value)}
                    >
                      <option value="">Selecione</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-greencard-primary mb-1 sm:mb-2">
                      Condição Médica
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg sm:rounded-xl focus:border-greencard-primary focus:outline-none transition-colors"
                      placeholder="Ex: Epilepsia, Ansiedade, etc"
                      value={formData.medicalCondition}
                      onChange={(e) => handleInputChange('medicalCondition', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-greencard-primary mb-1 sm:mb-2">
                    Alergias
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg sm:rounded-xl focus:border-greencard-primary focus:outline-none transition-colors"
                    placeholder="Ex: Penicilina, Lactose, etc"
                    value={formData.allergies}
                    onChange={(e) => handleInputChange('allergies', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-greencard-primary mb-1 sm:mb-2">
                    Contato de Emergência
                  </label>
                  <input
                    type="tel"
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg sm:rounded-xl focus:border-greencard-primary focus:outline-none transition-colors"
                    placeholder="(00) 00000-0000"
                    value={formData.emergencyContact}
                    onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                    maxLength={15}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-greencard-primary mb-1 sm:mb-2">
                      Nome do Médico
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg sm:rounded-xl focus:border-greencard-primary focus:outline-none transition-colors"
                      placeholder="Dr(a). Nome Completo"
                      value={formData.doctorName}
                      onChange={(e) => handleInputChange('doctorName', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-greencard-primary mb-1 sm:mb-2">
                      CRM
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg sm:rounded-xl focus:border-greencard-primary focus:outline-none transition-colors"
                      placeholder="00000/UF"
                      value={formData.crmNumber}
                      onChange={(e) => handleInputChange('crmNumber', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 3: FOTO */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-greencard-primary mb-2">
                Adicione sua Foto
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
                Faça upload de uma foto para personalizar sua carteirinha
              </p>
              
              <div className="max-w-md mx-auto">
                <label htmlFor="photo-upload" className="block cursor-pointer">
                  <div className="border-2 border-dashed border-greencard-tertiary rounded-xl p-12 hover:border-greencard-primary transition-colors">
                    {selectedImage ? (
                      <div className="text-center">
                        <img 
                          src={selectedImage} 
                          alt="Preview" 
                          className="w-32 h-32 object-cover rounded-lg mx-auto mb-4" 
                        />
                        <p className="text-greencard-primary font-semibold">
                          Foto selecionada!
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          Clique para trocar
                        </p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Camera className="h-16 w-16 text-greencard-primary mx-auto mb-4" />
                        <p className="text-lg font-medium text-gray-700">
                          Clique para adicionar sua foto
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          JPG, PNG até 5MB
                        </p>
                      </div>
                    )}
                  </div>
                </label>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                />
              </div>
            </div>
          )}

          {/* PASSO 4: REVISÃO */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-greencard-primary mb-2">
                Revisão Final
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
                Confirme todos os dados antes de gerar a carteirinha
              </p>
              
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="font-semibold text-greencard-primary mb-4">Preview da Carteirinha</h3>
                  <div className="flex justify-center">
                    <div ref={cardRef}>
                      <MedicalCard
                        formData={formData}
                        selectedImage={selectedImage}
                        cardNumber={cardNumber}
                        forExport={false}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-greencard-background/30 rounded-xl p-4">
                    <h3 className="font-semibold text-greencard-primary mb-3">Dados Pessoais</h3>
                    <div className="space-y-1 text-xs sm:text-sm">
                      <p><span className="font-semibold">Nome:</span> {formData.name || "---"}</p>
                      {formData.nickname && <p><span className="font-semibold">Apelido:</span> {formData.nickname}</p>}
                      <p><span className="font-semibold">CPF:</span> {formData.cpf || "---"}</p>
                      
                      {/* === CAMPO DE NASCIMENTO ATUALIZADO === */}
                      <p><span className="font-semibold">Nascimento:</span> {formatDateForDisplay(formData.birthDate)}</p>
                      
                      <p><span className="font-semibold">Nacionalidade:</span> {formData.nationality === 'brasileiro' ? 'Brasileiro' : formData.nationality || "---"}</p>
                      {formData.state && <p><span className="font-semibold">Estado:</span> {formData.state}</p>}
                      <p><span className="font-semibold">Telefone:</span> {formData.phone || "---"}</p>
                      <p><span className="font-semibold">E-mail:</span> {formData.email || "---"}</p>
                    </div>
                  </div>

                  <div className="bg-greencard-background/30 rounded-xl p-4">
                    <h3 className="font-semibold text-greencard-primary mb-3">Dados Médicos</h3>
                    <div className="space-y-1 text-xs sm:text-sm">
                      <p><span className="font-semibold">Tipo Sanguíneo:</span> {formData.bloodType || "---"}</p>
                      <p><span className="font-semibold">Alergias:</span> {formData.allergies || "---"}</p>
                      <p><span className="font-semibold">Emergência:</span> {formData.emergencyContact || "---"}</p>
                      <p><span className="font-semibold">Condição:</span> {formData.medicalCondition || "---"}</p>
                      <p><span className="font-semibold">Médico:</span> {formData.doctorName || "---"}</p>
                      {formData.crmNumber && <p><span className="font-semibold">CRM:</span> {formData.crmNumber}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 5: CARTEIRINHA PRONTA */}
          {currentStep === 5 && (
            <div className="text-center">
              {!showCard ? (
                <>
                  <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    className="w-16 h-16 sm:w-20 sm:h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4"
                  >
                    <Check className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                  </motion.div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-greencard-primary mb-2">
                    Carteirinha Gerada!
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600 mb-6">
                    Sua carteirinha digital está pronta para uso
                  </p>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
                    <p className="text-yellow-800 text-sm">
                      <strong>Importante:</strong> Guarde o número da sua carteirinha:
                      <span className="block font-mono text-lg mt-2">{cardNumber}</span>
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
                    <Printer className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                    <p className="text-blue-800 text-sm">
                      <strong>Impressão Profissional:</strong> O PDF está otimizado para impressoras de cartão PVC 
                      como a Zebra ZC300.
                    </p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button 
                      onClick={handleDownloadPDF} 
                      disabled={isGeneratingPDF}
                      className="bg-greencard-primary hover:bg-greencard-primary/90 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-full transition-colors inline-flex items-center gap-2 justify-center"
                    >
                      {isGeneratingPDF ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                          Gerando PDF...
                        </>
                      ) : (
                        <>
                          <Printer className="h-5 w-5" />
                          Baixar PDF
                        </>
                      )}
                    </button>
                    <button 
                      onClick={handleDownloadPNG} 
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold px-6 py-3 rounded-full transition-colors inline-flex items-center gap-2 justify-center"
                    >
                      <Download className="h-5 w-5" />
                      Baixar Imagem
                    </button>
                    <button 
                      onClick={() => setShowCard(true)} 
                      className="bg-greencard-secondary hover:bg-greencard-secondary/90 text-greencard-primary font-bold px-6 py-3 rounded-full transition-colors inline-flex items-center gap-2 justify-center"
                    >
                      <Eye className="h-5 w-5" />
                      Ver Carteirinha
                    </button>
                  </div>
                </>
              ) : (
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-greencard-primary mb-6">
                    Sua Carteirinha Digital
                  </h2>
                  
                  <div className="flex justify-center mb-6">
                    <div ref={cardRef}>
                      <MedicalCard
                        formData={formData}
                        selectedImage={selectedImage}
                        cardNumber={cardNumber}
                        forExport={false}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button 
                      onClick={handleDownloadPDF} 
                      disabled={isGeneratingPDF}
                      className="bg-greencard-primary hover:bg-greencard-primary/90 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-full transition-colors inline-flex items-center gap-2 justify-center"
                    >
                      {isGeneratingPDF ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                          Gerando PDF...
                        </>
                      ) : (
                        <>
                          <Printer className="h-5 w-5" />
                          Baixar PDF
                        </>
                      )}
                    </button>
                    <button 
                      onClick={handleDownloadPNG} 
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold px-6 py-3 rounded-full transition-colors inline-flex items-center gap-2 justify-center"
                    >
                      <Download className="h-5 w-5" />
                      Baixar Imagem
                    </button>
                    <button 
                      onClick={() => setShowCard(false)} 
                      className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold px-6 py-3 rounded-full transition-colors"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botões de Navegação */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            {currentStep > 1 && currentStep < 5 && (
              <button 
                onClick={handleBack} 
                className="px-6 py-3 text-greencard-primary font-semibold hover:bg-greencard-background rounded-xl transition-colors"
              >
                Voltar
              </button>
            )}
            
            {currentStep < 4 && (
              <button 
                onClick={handleNext} 
                className="ml-auto bg-greencard-primary hover:bg-greencard-primary/90 text-white font-bold px-8 py-3 rounded-full transition-colors"
              >
                Próximo
              </button>
            )}

            {currentStep === 4 && (
              <button
                onClick={handleFinalize}
                disabled={isLoading}
                className="ml-auto bg-greencard-primary hover:bg-greencard-primary/90 text-white font-bold px-8 py-3 rounded-full transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    Finalizar Cadastro
                  </>
                )}
              </button>
            )}
            
            {currentStep === 5 && !showCard && (
              <Link 
                href="/" 
                className="ml-auto bg-greencard-secondary hover:bg-greencard-secondary/90 text-greencard-primary font-bold px-8 py-3 rounded-full transition-colors inline-flex items-center gap-2"
              >
                <ArrowLeft className="h-5 w-5" />
                Voltar ao Início
              </Link>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}