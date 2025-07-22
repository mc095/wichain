import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const icons = [
  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
   </svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
   </svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2m-4 0H7a2 2 0 01-2-2v-6a2 2 0 012-2h2" />
   </svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
   </svg>`,
];

const slides = [
  {
    title: 'Welcome to WiChain',
    description: 'Secure, decentralized chat over your local network. Connect with peers and groups effortlessly.',
    icon: icons[0],
  },
  {
    title: 'Peer-to-Peer Messaging',
    description: 'Send direct messages to peers with end-to-end obfuscation for privacy.',
    icon: icons[1],
  },
  {
    title: 'Group Chats',
    description: 'Create and join group conversations with your network securely.',
    icon: icons[2],
  },
  {
    title: 'Blockchain-Backed',
    description: 'Your chats are stored locally in a tamper-evident blockchain for reliability.',
    icon: icons[3],
  },
];

interface Props {
  onGetStarted: () => void;
}

export function OnboardingSlideshow({ onGetStarted }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  return (
    <div className="slideshow-container">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          className="slide"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="slide-icon"
            dangerouslySetInnerHTML={{ __html: slides[currentSlide].icon }}
          />
          <h2 className="slide-title">{slides[currentSlide].title}</h2>
          <p className="slide-description">{slides[currentSlide].description}</p>
          {currentSlide === slides.length - 1 ? (
            <motion.button
              className="mt-6 rounded-full bg-[var(--primary-dark)] px-6 py-2 text-sm font-semibold text-white hover:bg-[var(--primary)]"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onGetStarted}
            >
              Get Started
            </motion.button>
          ) : (
            <motion.button
              className="mt-6 rounded-full bg-[var(--primary-dark)] px-6 py-2 text-sm font-semibold text-white hover:bg-[var(--primary)]"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={nextSlide}
            >
              Next
            </motion.button>
          )}
        </motion.div>
      </AnimatePresence>
      <div className="absolute bottom-8 flex justify-center">
        {slides.map((_, index) => (
          <span
            key={index}
            className={`dot ${index === currentSlide ? 'active' : ''}`}
            onClick={() => setCurrentSlide(index)}
          />
        ))}
      </div>
      {currentSlide > 0 && (
        <motion.button
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-[var(--primary-dark)] p-2 text-white hover:bg-[var(--primary)]"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={prevSlide}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </motion.button>
      )}
    </div>
  );
}