// LAWLINK — Dedicated Legal Help Location Discovery Panel
// Modular location-based discovery for verified Indian legal aid, cyber crime cells,
// consumer forums, and statutory helplines.

import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  ShieldCheck, 
  Phone, 
  ExternalLink, 
  Navigation, 
  Clock, 
  AlertCircle,
  Filter,
  CheckCircle2,
  Building2,
  Scale
} from 'lucide-react';
import { 
  VERIFIED_STATES_CITIES, 
  VERIFIED_LEGAL_RESOURCES,
  LEGAL_HELP_CATEGORIES,
  queryVerifiedLegalHelp,
  buildGoogleMapsDirectionsUrl
} from '../data/verifiedLegalDirectory';

export const LegalHelpPanel = ({ onBackToChat }) => {
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Available states
  const states = useMemo(() => Object.keys(VERIFIED_STATES_CITIES), []);

  // Cities for currently selected state
  const availableCities = useMemo(() => {
    if (!selectedState) return [];
    return VERIFIED_STATES_CITIES[selectedState] || [];
  }, [selectedState]);

  // Handle state change: reset city
  const handleStateChange = (e) => {
    const newState = e.target.value;
    setSelectedState(newState);
    setSelectedCity('');
  };

  // Filtered verified resources
  const resources = useMemo(() => {
    if (!selectedState && !selectedCity) {
      return [];
    }
    return queryVerifiedLegalHelp({
      state: selectedState,
      city: selectedCity,
      category: selectedCategory
    });
  }, [selectedState, selectedCity, selectedCategory]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#ffffff',
      overflow: 'hidden'
    }}>
      {/* Top Navigation Bar: Back to Chat */}
      <div style={{
        padding: '0.65rem 0.85rem',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <button
          onClick={onBackToChat}
          style={{
            background: 'none',
            border: 'none',
            color: '#4f46e5',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.4rem',
            borderRadius: '6px',
            transition: 'background 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#eef2ff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <ArrowLeft size={16} /> ← Back to Chat
        </button>

        <span style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          color: '#059669',
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          padding: '0.15rem 0.5rem',
          borderRadius: '999px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          <ShieldCheck size={12} /> Verified Support
        </span>
      </div>

      {/* Scrollable Content Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.9rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}>
        {/* Header Introduction */}
        <div>
          <h3 style={{
            fontSize: '1.05rem',
            fontWeight: 800,
            color: '#0f172a',
            margin: '0 0 0.25rem 0'
          }}>
            How can we help you?
          </h3>
          <p style={{
            fontSize: '0.78rem',
            color: '#64748b',
            lineHeight: 1.45,
            margin: 0
          }}>
            Find verified legal-support resources based on your location.
          </p>
        </div>

        {/* Location Selector Form */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <MapPin size={13} color="#4f46e5" /> Select Your Location:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {/* State Select */}
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: '#64748b', marginBottom: '0.2rem' }}>
                State:
              </label>
              <select
                value={selectedState}
                onChange={handleStateChange}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.5rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.78rem',
                  color: '#0f172a',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="">-- Choose State --</option>
                {states.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* City Select */}
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: '#64748b', marginBottom: '0.2rem' }}>
                City:
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                disabled={!selectedState}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.5rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: !selectedState ? '#f1f5f9' : '#ffffff',
                  fontSize: '0.78rem',
                  color: !selectedState ? '#94a3b8' : '#0f172a',
                  outline: 'none',
                  cursor: !selectedState ? 'not-allowed' : 'pointer'
                }}
              >
                <option value="">{selectedState ? '-- Choose City --' : 'Select State first'}</option>
                {availableCities.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category Filter Chips */}
          {selectedState && (
            <div style={{ marginTop: '0.2rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Filter size={11} /> Filter by Need:
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
                {LEGAL_HELP_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      background: selectedCategory === cat.id ? '#4f46e5' : '#ffffff',
                      color: selectedCategory === cat.id ? '#ffffff' : '#475569',
                      border: `1px solid ${selectedCategory === cat.id ? '#4f46e5' : '#cbd5e1'}`,
                      borderRadius: '999px',
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Resources List Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Prompt to select location if not selected */}
          {!selectedState && (
            <div style={{
              textAlign: 'center',
              padding: '1.5rem 1rem',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px dashed #cbd5e1',
              color: '#64748b'
            }}>
              <Building2 size={28} color="#94a3b8" style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155' }}>
                Select your State and City above
              </div>
              <div style={{ fontSize: '0.74rem', marginTop: '0.25rem' }}>
                We will display official legal aid centers, cybercrime cells, and consumer dispute commissions in your jurisdiction.
              </div>
            </div>
          )}

          {/* Results Displayed */}
          {selectedState && resources.length > 0 && (
            <>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Verified Official Resources ({resources.length}):
              </div>

              {resources.map(res => (
                <div
                  key={res.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '0.85rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    transition: 'border-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366f1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
                >
                  {/* Top Bar: Name & Verified Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.15rem 0', lineHeight: 1.3 }}>
                        {res.name}
                      </h4>
                      <span style={{
                        display: 'inline-block',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: res.category === 'legal_aid' ? '#4f46e5' : res.category === 'cybercrime' ? '#dc2626' : res.category === 'consumer' ? '#d97706' : '#db2777',
                        background: res.category === 'legal_aid' ? '#eef2ff' : res.category === 'cybercrime' ? '#fef2f2' : res.category === 'consumer' ? '#fffbeb' : '#fdf2f8',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '4px'
                      }}>
                        {res.type}
                      </span>
                    </div>

                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      color: '#059669',
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem'
                    }}>
                      <CheckCircle2 size={11} /> Verified
                    </span>
                  </div>

                  {/* Address / Location */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', fontSize: '0.74rem', color: '#475569', lineHeight: 1.4 }}>
                    <MapPin size={13} color="#64748b" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{res.address}</span>
                  </div>

                  {/* Short Description */}
                  <div style={{ fontSize: '0.74rem', color: '#334155', lineHeight: 1.45, background: '#f8fafc', padding: '0.45rem 0.6rem', borderRadius: '6px' }}>
                    {res.description}
                  </div>

                  {/* Timings */}
                  {res.timings && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: '#64748b' }}>
                      <Clock size={12} />
                      <span>{res.timings}</span>
                    </div>
                  )}

                  {/* Contact & Actions Footer */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.4rem',
                    borderTop: '1px solid #f1f5f9',
                    flexWrap: 'wrap',
                    gap: '0.4rem'
                  }}>
                    {/* Phone / Helpline */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>
                      {res.tollFree && (
                        <a
                          href={`tel:${res.tollFree.replace(/[^0-9]/g, '')}`}
                          style={{
                            color: '#059669',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            background: '#ecfdf5',
                            padding: '0.2rem 0.45rem',
                            borderRadius: '4px'
                          }}
                        >
                          <Phone size={11} /> {res.tollFree}
                        </a>
                      )}
                      {res.phone && (
                        <a
                          href={`tel:${res.phone.replace(/[^0-9]/g, '')}`}
                          style={{
                            color: '#334155',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <Phone size={11} /> {res.phone}
                        </a>
                      )}
                    </div>

                    {/* Links & Directions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {/* Official Website */}
                      {res.officialUrl && (
                        <a
                          href={res.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '0.72rem',
                            color: '#4f46e5',
                            textDecoration: 'none',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.25rem 0.45rem',
                            borderRadius: '6px',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            background: '#eef2ff'
                          }}
                        >
                          Website <ExternalLink size={11} />
                        </a>
                      )}

                      {/* Google Maps Directions */}
                      <a
                        href={buildGoogleMapsDirectionsUrl(res)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '0.72rem',
                          color: '#ffffff',
                          textDecoration: 'none',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.55rem',
                          borderRadius: '6px',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        <Navigation size={11} /> Directions
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Empty State: No Verified Resource Found for this location */}
          {selectedState && resources.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '1.5rem 1rem',
              background: '#fef2f2',
              borderRadius: '12px',
              border: '1px solid #fecaca',
              color: '#991b1b'
            }}>
              <AlertCircle size={28} color="#dc2626" style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                No Local Verified Resource Listed
              </div>
              <div style={{ fontSize: '0.76rem', color: '#b91c1c', lineHeight: 1.45, marginBottom: '0.85rem' }}>
                We couldn't find a verified resource for this location. Please try another location or visit an official legal-services website.
              </div>

              {/* National Fallback Portals */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                padding: '0.6rem',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#7f1d1d' }}>
                  Nationwide 24x7 Statutory Helplines:
                </div>
                <div style={{ fontSize: '0.72rem', color: '#334155' }}>
                  • <strong>NALSA Legal Aid:</strong> <a href="tel:15100" style={{ color: '#059669', fontWeight: 700 }}>15100</a> (Toll-Free, Pan-India)
                </div>
                <div style={{ fontSize: '0.72rem', color: '#334155' }}>
                  • <strong>National Cybercrime Helpline:</strong> <a href="tel:1930" style={{ color: '#dc2626', fontWeight: 700 }}>1930</a> (24x7)
                </div>
                <div style={{ fontSize: '0.72rem', color: '#334155' }}>
                  • <strong>National Consumer Helpline:</strong> <a href="tel:1915" style={{ color: '#d97706', fontWeight: 700 }}>1915</a> / <a href="https://consumerhelpline.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: '#4f46e5' }}>Portal</a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Legal Disclaimer */}
        <div style={{
          marginTop: 'auto',
          padding: '0.65rem 0.8rem',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          fontSize: '0.68rem',
          color: '#64748b',
          lineHeight: 1.4,
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.4rem'
        }}>
          <Scale size={14} color="#94a3b8" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>Disclaimer:</strong> LawLink provides general legal awareness and does not replace advice from a qualified legal professional.
          </span>
        </div>
      </div>
    </div>
  );
};
