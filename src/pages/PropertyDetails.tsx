// src/pages/PropertyDetails.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bed, 
  Bath, 
  Square, 
  MapPin, 
  ArrowLeft, 
  Phone, 
  Mail, 
  Play, 
  Box, 
  Check, 
  Copy, 
  Heart 
} from 'lucide-react';

import { Property } from '../types.js';
import { api } from '../services/api.js';
import { ContactForm } from '../components/ContactForm';
import { useFavorites } from '../lib/useFavorites';
import { useAuth } from '../contexts/AuthContext';   // ← Add this if you have auth context

export const PropertyDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [activeImage, setActiveImage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const { toggleFavorite, isFavorite } = useFavorites();
  const { user } = useAuth();   // Optional: if you want to show different UI for logged-in users

  // Fetch property details
  useEffect(() => {
    const fetchProperty = async () => {
      if (!id) return;
      
      try {
        const data = await api.get(`/properties/${id}`);
        setProperty(data);
        if (data.imageUrl) setActiveImage(data.imageUrl);
      } catch (err) {
        console.error('Failed to fetch property:', err);
        setToast({ message: 'Failed to load property details', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProperty();
  }, [id]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleShare = async () => {
    if (!property) return;

    const shareData = {
      title: property.title,
      text: `Check out this property: ${property.title} at ${property.address}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        showToast('Shared successfully!');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          await navigator.clipboard.writeText(window.location.href);
          showToast('Link copied to clipboard!', 'info');
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        showToast('Link copied to clipboard!', 'info');
      } catch (err) {
        console.error('Failed to copy link', err);
      }
    }
  };

  const handleToggleFavorite = () => {
    if (!property) return;
    
    const propertyId = Number(property.id);
    const currentlyLiked = isFavorite(propertyId);
    
    toggleFavorite(propertyId);
    showToast(currentlyLiked ? 'Removed from favorites' : 'Added to favorites');
  };

  if (isLoading) {
    return (
      <div className="pt-40 pb-20 text-center animate-pulse">
        <div className="max-w-7xl mx-auto px-6 space-y-8">
          <div className="h-96 bg-gray-200 rounded-3xl"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 h-64 bg-gray-200 rounded-3xl"></div>
            <div className="lg:col-span-1 h-64 bg-gray-200 rounded-3xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="pt-40 pb-20 text-center">
        <h2 className="text-3xl font-serif font-bold text-brand-navy">Property Not Found</h2>
        <Link to="/listings" className="text-brand-gold hover:underline mt-6 inline-block">
          ← Back to Listings
        </Link>
      </div>
    );
  }

  const isLiked = isFavorite(Number(property.id));

  return (
    <div className="pt-24 min-h-screen bg-brand-cream relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[220px]
              ${toast.type === 'success' ? 'bg-brand-navy text-white' : 
                toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'}`}
          >
            {toast.type === 'success' && <Check className="w-5 h-5 text-brand-gold" />}
            {toast.type === 'error' && <span>⚠️</span>}
            <span className="font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Actions */}
      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-wrap justify-between items-center gap-4">
        <Link 
          to="/listings" 
          className="flex items-center gap-2 text-brand-navy font-bold hover:text-brand-gold transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> Back to Listings
        </Link>

        <div className="flex gap-3">
          <button 
            onClick={handleShare}
            className="p-3 rounded-full bg-white shadow-sm hover:shadow-md transition-all text-brand-navy hover:text-brand-gold"
            title="Share Property"
          >
            <Share2 className="w-5 h-5" />
          </button>

          <button 
            onClick={handleToggleFavorite}
            className={`p-3 rounded-full bg-white shadow-sm hover:shadow-md transition-all ${isLiked ? 'text-red-500' : 'text-brand-navy hover:text-red-500'}`}
            title={isLiked ? "Remove from Favorites" : "Add to Favorites"}
          >
            <Heart className={`w-5 h-5 transition-all ${isLiked ? 'fill-red-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Gallery */}
      <section className="px-4 md:px-6 pb-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          <div className="lg:col-span-8">
            <motion.div 
              className="aspect-[16/10] rounded-3xl overflow-hidden shadow-2xl bg-gray-100"
            >
              <img
                src={activeImage || property.imageUrl}
                alt={property.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>

          {/* Thumbnail Gallery */}
          <div className="lg:col-span-4 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0">
            {[property.imageUrl, ...(property.images || [])]
              .filter(Boolean)
              .filter((img, index, self) => self.indexOf(img) === index)
              .map((img, idx) => (
                <div 
                  key={idx}
                  onClick={() => setActiveImage(img)}
                  className={`flex-shrink-0 w-28 lg:w-full aspect-video rounded-2xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-105
                    ${activeImage === img ? 'border-brand-gold shadow-md' : 'border-transparent opacity-75 hover:opacity-100'}`}
                >
                  <img
                    src={img}
                    alt={`View ${idx + 1}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="section-padding pt-0">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-10">
            <div>
              <div className="flex flex-wrap gap-3 mb-4">
                <span className="bg-brand-navy text-white px-4 py-1 rounded-full text-xs font-bold tracking-widest">
                  {property.type}
                </span>
                <span className={`px-4 py-1 rounded-full text-xs font-bold tracking-widest ${
                  property.status === 'Sold' ? 'bg-red-500 text-white' : 
                  property.status === 'Pending' ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'
                }`}>
                  {property.status}
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-serif font-bold text-brand-navy leading-tight">
                {property.title}
              </h1>

              <div className="flex items-center gap-2 mt-4 text-gray-600">
                <MapPin className="w-5 h-5 text-brand-gold" />
                <span>{property.address}, {property.city}, {property.state} {property.zip}</span>
              </div>
            </div>

            {/* Price & Key Specs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-8 border-y border-gray-200">
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-400">Price</p>
                <p className="text-3xl font-bold text-brand-navy mt-1">
                  ${Number(property.price).toLocaleString()}
                </p>
              </div>

              {property.beds && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-400">Bedrooms</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Bed className="w-6 h-6 text-brand-gold" />
                    <span className="text-2xl font-bold text-brand-navy">{property.beds}</span>
                  </div>
                </div>
              )}

              {property.baths && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-400">Bathrooms</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Bath className="w-6 h-6 text-brand-gold" />
                    <span className="text-2xl font-bold text-brand-navy">{property.baths}</span>
                  </div>
                </div>
              )}

              {property.sqft && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-400">Sq Ft</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Square className="w-6 h-6 text-brand-gold" />
                    <span className="text-2xl font-bold text-brand-navy">{property.sqft.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-4">
              <h3 className="text-2xl font-serif font-bold text-brand-navy">Description</h3>
              <p className="text-lg leading-relaxed text-gray-700 whitespace-pre-line">
                {property.description}
              </p>
            </div>

            {/* Features */}
            <div className="space-y-4">
              <h3 className="text-2xl font-serif font-bold text-brand-navy">Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3">
                {(property.features || []).map((feature: string, index: number) => (
                  <div key={index} className="flex items-start gap-3 text-gray-700">
                    <Check className="w-5 h-5 text-brand-gold mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 space-y-8">
              {/* Agent Card */}
              <div className="bg-white rounded-3xl shadow-xl p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100">
                    <img 
                      src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=200" 
                      alt="Agent" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="font-serif text-xl font-bold">Janet Stanley</h4>
                    <p className="text-sm text-gray-500">Principal Broker</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <a href="tel:+13046593067" className="block w-full py-4 bg-brand-navy text-white rounded-2xl text-center font-medium hover:bg-black transition-colors">
                    Call Agent
                  </a>
                  <a href="mailto:janetstanley@frontier.com" className="block w-full py-4 border border-gray-300 rounded-2xl text-center font-medium hover:bg-gray-50 transition-colors">
                    Email Agent
                  </a>
                </div>
              </div>

              {/* Contact Form */}
              <ContactForm 
                propertyId={Number(property.id)} 
                defaultMessage={`I'm interested in ${property.title} at ${property.address}.`} 
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
