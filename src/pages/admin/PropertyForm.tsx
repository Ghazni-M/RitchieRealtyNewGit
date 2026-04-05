// src/pages/admin/PropertyForm.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Plus, X, Image as ImageIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../../services/api.js';

export const PropertyForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState<any>({
    title: '',
    price: '',
    address: '',
    city: 'Pennsboro',
    state: 'WV',
    zip: '26415',
    beds: '',
    baths: '',
    sqft: '',
    type: 'Residential',
    status: 'Available',
    featured: false,
    imageUrl: '',
    images: [],
    videoUrl: '',
    virtualTourUrl: '',
    description: '',
    features: [],
    acreage: '',
    zoning: '',
  });

  const [newImageUrl, setNewImageUrl] = useState('');
  const [newFeature, setNewFeature] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch property data when editing
  useEffect(() => {
    if (isEdit && id) {
      const fetchProperty = async () => {
        try {
          const data = await api.get(`/properties/${id}`);
          setFormData({
            ...data,
            price: data.price || '',
            beds: data.beds || '',
            baths: data.baths || '',
            sqft: data.sqft || '',
            acreage: data.acreage || '',
            features: Array.isArray(data.features) ? data.features : [],
            images: Array.isArray(data.images) ? data.images : [],
          });
        } catch (err) {
          console.error('Failed to fetch property for editing', err);
          alert('Could not load property for editing');
          navigate('/admin/properties');
        }
      };
      fetchProperty();
    }
  }, [id, isEdit, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    setFormData((prev: any) => ({
      ...prev,
      images: [...(prev.images || []), newImageUrl.trim()],
    }));
    setNewImageUrl('');
  };

  const handleRemoveImage = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      images: prev.images.filter((_: string, i: number) => i !== index),
    }));
  };

  const handleAddFeature = () => {
    if (!newFeature.trim()) return;
    const trimmed = newFeature.trim();
    if (formData.features.includes(trimmed)) {
      setNewFeature('');
      return;
    }
    setFormData((prev: any) => ({
      ...prev,
      features: [...(prev.features || []), trimmed],
    }));
    setNewFeature('');
  };

  const handleRemoveFeature = (feature: string) => {
    setFormData((prev: any) => ({
      ...prev,
      features: (prev.features || []).filter((f: string) => f !== feature),
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'gallery') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const result = await api.upload(files[i]);
        if (type === 'main') {
          setFormData((prev: any) => ({ ...prev, imageUrl: result.url }));
        } else {
          setFormData((prev: any) => ({
            ...prev,
            images: [...(prev.images || []), result.url],
          }));
        }
      }
    } catch (err: any) {
      alert('Image upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const submissionData = {
      ...formData,
      price: Number(formData.price) || 0,
      beds: formData.type === 'Land' || formData.type === 'Commercial' ? 0 : Number(formData.beds) || 0,
      baths: formData.type === 'Land' ? 0 : Number(formData.baths) || 0,
      sqft: formData.type === 'Land' ? 0 : Number(formData.sqft) || 0,
      acreage: Number(formData.acreage) || 0,
      featured: Boolean(formData.featured),
      features: formData.features || [],
      images: formData.images || [],
    };

    try {
      if (isEdit) {
        await api.put(`/properties/${id}`, submissionData);
        alert('Property updated successfully!');
      } else {
        await api.post('/properties', submissionData);
        alert('Property created successfully!');
      }
      navigate('/admin/properties');
    } catch (err: any) {
      console.error(err);
      alert('Failed to save property: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <Link 
          to="/admin/properties" 
          className="flex items-center gap-2 text-brand-navy font-bold hover:text-brand-gold transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> Back to Properties
        </Link>
        <h1 className="text-3xl font-serif font-bold text-brand-navy">
          {isEdit ? 'Edit Property' : 'Add New Property'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
          <h3 className="text-xl font-serif font-bold text-brand-navy border-b border-gray-50 pb-4">Basic Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-navy">Property Title</label>
              <input
                type="text"
                name="title"
                required
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-6 py-4 rounded-2xl bg-brand-cream focus:ring-2 focus:ring-brand-gold outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-navy">Price ($)</label>
              <input
                type="number"
                name="price"
                required
                value={formData.price}
                onChange={handleInputChange}
                className="w-full px-6 py-4 rounded-2xl bg-brand-cream focus:ring-2 focus:ring-brand-gold outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-brand-navy">Address</label>
            <input
              type="text"
              name="address"
              required
              value={formData.address}
              onChange={handleInputChange}
              className="w-full px-6 py-4 rounded-2xl bg-brand-cream focus:ring-2 focus:ring-brand-gold outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-navy">City</label>
              <input type="text" name="city" required value={formData.city} onChange={handleInputChange} className="w-full px-6 py-4 rounded-2xl bg-brand-cream focus:ring-2 focus:ring-brand-gold outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-navy">State</label>
              <input type="text" name="state" required value={formData.state} onChange={handleInputChange} className="w-full px-6 py-4 rounded-2xl bg-brand-cream focus:ring-2 focus:ring-brand-gold outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-navy">ZIP Code</label>
              <input type="text" name="zip" required value={formData.zip} onChange={handleInputChange} className="w-full px-6 py-4 rounded-2xl bg-brand-cream focus:ring-2 focus:ring-brand-gold outline-none" />
            </div>
          </div>
        </div>

        {/* Property Details */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
          <h3 className="text-xl font-serif font-bold text-brand-navy border-b border-gray-50 pb-4">Property Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {formData.type !== 'Land' && formData.type !== 'Commercial' && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-navy">Bedrooms</label>
                <input type="number" name="beds" value={formData.beds} onChange={handleInputChange} className="w-full px-6 py-4 rounded-2xl bg-brand-cream focus:ring-2 focus:ring-brand-gold outline-none" />
              </div>
            )}
            {formData.type !== 'Land' && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-navy">Bathrooms</label>
                <input type="number" step="0.5" name="baths" value={formData.baths} onChange={handleInputChange} className="w-full px-6 py-4 rounded-2xl bg-brand-cream focus:ring-2 focus:ring-brand-gold outline-none" />
              </div>
            )}
            {formData.type !== 'Land' && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-navy">Square Feet</label>
                <input type="number" name="sqft" value={formData.sqft} onChange={handleInputChange} className="w-full px-6 py-4 rounded-2xl bg-brand-cream focus:ring-2 focus:ring-brand-gold outline-none" />
              </div>
            )}
            {formData.type === 'Land' && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-navy">Acreage</label>
                <input type="number" step="0.01" name="acreage" value={formData.acreage} onChange={handleInputChange} className="w-full px-6 py-4 rounded-2xl bg-brand-cream focus:ring-2 focus:ring-brand-gold outline-none" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-navy">Property Type</label>
              <select name="type" value={formData.type} onChange={handleInputChange} className="w-full px-6 py-4 rounded-2xl bg-brand-cream focus:ring-2 focus:ring-brand-gold outline-none">
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Land">Land</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-navy">Status</label>
              <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-6 py-4 rounded-2xl bg-brand-cream focus:ring-2 focus:ring-brand-gold outline-none">
                <option value="Available">Available</option>
                <option value="Sold">Sold</option>
                <option value="Under Contract">Under Contract</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-brand-navy">Description</label>
            <textarea
              name="description"
              rows={6}
              value={formData.description}
              onChange={handleInputChange}
              className="w-full px-6 py-4 rounded-2xl bg-brand-cream focus:ring-2 focus:ring-brand-gold outline-none resize-y"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="featured"
              id="featured"
              checked={formData.featured}
              onChange={handleInputChange}
              className="w-5 h-5 rounded border-gray-300 text-brand-navy"
            />
            <label htmlFor="featured" className="text-sm font-semibold text-brand-navy">
              Feature this property on homepage
            </label>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
          <h3 className="text-xl font-serif font-bold text-brand-navy">Property Features</h3>
          <div className="flex gap-4">
            <input
              type="text"
              value={newFeature}
              onChange={(e) => setNewFeature(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFeature())}
              placeholder="e.g. Hardwood floors, Updated kitchen..."
              className="flex-1 px-6 py-4 rounded-2xl bg-brand-cream focus:ring-2 focus:ring-brand-gold outline-none"
            />
            <button
              type="button"
              onClick={handleAddFeature}
              className="bg-brand-gold text-brand-navy px-8 py-4 rounded-2xl hover:bg-brand-gold/90 transition-all"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            {formData.features.map((feature: string, idx: number) => (
              <div key={idx} className="flex items-center gap-2 bg-brand-navy text-white px-4 py-2 rounded-full text-sm">
                {feature}
                <button type="button" onClick={() => handleRemoveFeature(feature)} className="hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4 pt-8">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-brand-navy text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all disabled:opacity-70"
          >
            {isLoading ? 'Saving...' : isEdit ? 'Update Property' : 'Create Property'}
            <Save className="w-5 h-5" />
          </button>

          <Link
            to="/admin/properties"
            className="px-10 py-4 border-2 border-gray-300 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 transition-all"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
};
