import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Zap, 
  Users, 
  Lock, 
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  Check
} from 'lucide-react';

interface Props {
  onGetStarted: () => void;
}

const slides = [
  {
    icon: Shield,
    title: "End-to-End Encryption",
    description: "Your messages are protected with military-grade AES-256-GCM encryption. Only you and your recipients can read them.",
    color: "from-blue-500 to-cyan-500",
    features: ["AES-256-GCM encryption", "Perfect forward secrecy", "Zero-knowledge architecture"]
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Direct peer-to-peer communication with TCP and UDP fallback ensures your messages reach their destination instantly.",
    color: "from-yellow-500 to-orange-500",
    features: ["Direct P2P connection", "TCP/UDP fallback", "Real-time messaging"]
  },
  {
    icon: Users,
    title: "Decentralized Network",
    description: "No central servers, no data collection. Your conversations stay between you and your peers, always.",
    color: "from-green-500 to-emerald-500",
    features: ["No central servers", "Privacy by design", "Peer-to-peer only"]
  },
  {
    icon: Lock,
    title: "Complete Privacy",
    description: "Your identity is cryptographically secure. No phone numbers, no email addresses, just secure keys.",
    color: "from-purple-500 to-pink-500",
    features: ["Anonymous identities", "No personal data", "Cryptographic security"]
  }
];

export function OnboardingSlideshow({ onGetStarted }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [completedSlides, setCompletedSlides] = useState<number[]>([]);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCompletedSlides(prev => [...prev, currentSlide]);
      setCurrentSlide(prev => prev + 1);
    } else {
      onGetStarted();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  const currentSlideData = slides[currentSlide];
  const progress = ((currentSlide + 1) / slides.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background Animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
        
        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-white/10 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-4xl">
        {/* Header */}
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 20,
              delay: 0.3 
            }}
          >
            <MessageCircle size={40} className="text-white" />
          </motion.div>
          
          <motion.h1 
            className="text-4xl md:text-6xl font-display text-white mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Welcome to{' '}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              WiChain
            </span>
          </motion.h1>
          
          <motion.p 
            className="text-xl text-slate-300 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            The future of secure, decentralized messaging
          </motion.p>
        </motion.div>

        {/* Progress Bar */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">
              Step {currentSlide + 1} of {slides.length}
            </span>
            <span className="text-sm text-slate-400">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full bg-slate-700/50 rounded-full h-2">
            <motion.div 
              className="h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>

        {/* Slide Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.5 }}
          >
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 md:p-12">
              <div className="text-center">
                {/* Icon */}
                <motion.div
                  className={`w-24 h-24 bg-gradient-to-br ${currentSlideData.color} rounded-full flex items-center justify-center mx-auto mb-8`}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 300, 
                    damping: 20,
                    delay: 0.2 
                  }}
                >
                  <currentSlideData.icon size={48} className="text-white" />
                </motion.div>

                {/* Title */}
                <motion.h2 
                  className="text-3xl md:text-4xl font-display text-white mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {currentSlideData.title}
                </motion.h2>

                {/* Description */}
                <motion.p 
                  className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  {currentSlideData.description}
                </motion.p>

                {/* Features */}
                <motion.div 
                  className="space-y-3 mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  {currentSlideData.features.map((feature, index) => (
                    <motion.div 
                      key={feature}
                      className="flex items-center justify-center space-x-3 text-slate-300"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                    >
                      <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                        <Check size={14} className="text-green-400" />
                      </div>
                      <span className="text-sm">{feature}</span>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <motion.div 
          className="flex items-center justify-between mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <button
            className="flex items-center space-x-2 px-4 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            onClick={prevSlide}
            disabled={currentSlide === 0}
          >
            <ArrowLeft size={16} />
            <span>Previous</span>
          </button>

          <div className="flex space-x-2">
            {slides.map((_, index) => (
              <motion.button
                key={index}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentSlide 
                    ? 'bg-blue-500 scale-125' 
                    : completedSlides.includes(index)
                    ? 'bg-green-500'
                    : 'bg-slate-600'
                }`}
                onClick={() => setCurrentSlide(index)}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              />
            ))}
          </div>

          <button
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200"
            onClick={nextSlide}
          >
            <span>{currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}</span>
            {currentSlide === slides.length - 1 ? <Check size={16} /> : <ArrowRight size={16} />}
          </button>
        </motion.div>
      </div>
    </div>
  );
}