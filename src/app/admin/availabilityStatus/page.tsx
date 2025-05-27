"use client";
import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Settings, Save, Loader2, CheckCircle, AlertCircle, Globe } from 'lucide-react';

interface AvailabilitySettings {
  _id?: string;
  startTime: string;
  endTime: string;
  slotDuration: number;
  admintimezone: string;
  bufferBetweenSlots: number;
}

const AvailabilityAdmin = () => {
  const [settings, setSettings] = useState<AvailabilitySettings>({
    startTime: '09:00',
    endTime: '17:00',
    slotDuration: 20,
    admintimezone: 'America/New_York',
    bufferBetweenSlots: 10
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Common timezones for the dropdown
  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Kolkata',
    'Asia/Kathmandu',
    'Australia/Sydney',
    'Pacific/Auckland'
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/availability');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setIsInitialized(true);
      } else if (response.status === 404) {
        // No settings configured yet, use defaults
        setIsInitialized(true);
      }
    } catch (error) {
      showMessage('error', 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const method = settings._id ? 'PATCH' : 'POST';
      const response = await fetch('/api/availability', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        showMessage('success', 'Settings saved successfully!');
      } else {
        const error = await response.json();
        showMessage('error', error.error || 'Failed to save settings');
      }
    } catch (error) {
      showMessage('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleInputChange = (field: keyof AvailabilitySettings, value: string | number) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const calculateWorkingHours = () => {
    if (!settings.startTime || !settings.endTime) return '0';
    const [startHour, startMin] = settings.startTime.split(':').map(Number);
    const [endHour, endMin] = settings.endTime.split(':').map(Number);
    const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    return (totalMinutes / 60).toFixed(1);
  };

  const calculateSlotsPerDay = () => {
    if (!settings.startTime || !settings.endTime) return '0';
    const [startHour, startMin] = settings.startTime.split(':').map(Number);
    const [endHour, endMin] = settings.endTime.split(':').map(Number);
    const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    const slotWithBuffer = settings.slotDuration + settings.bufferBetweenSlots;
    return Math.floor(totalMinutes / slotWithBuffer);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="flex items-center space-x-3 text-blue-600">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-xl font-medium">Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 pt-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-6 shadow-lg">
            <Settings className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-3">
            Availability Settings
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Configure your working hours, appointment slots, and timezone preferences to manage your schedule effectively.
          </p>
        </div>

        {/* Message Alert */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl border-l-4 ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-400 text-green-800' 
              : 'bg-red-50 border-red-400 text-red-800'
          } animate-in slide-in-from-top-2 duration-300`}>
            <div className="flex items-center">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 mr-3" />
              ) : (
                <AlertCircle className="w-5 h-5 mr-3" />
              )}
              <span className="font-medium">{message.text}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Settings Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
              <h2 className="text-2xl font-bold text-white mb-2">Working Hours Configuration</h2>
              <p className="text-blue-100">Set your availability and appointment preferences</p>
            </div>
            
            <div className="p-8 space-y-8">
              {/* Time Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                    <Clock className="w-4 h-4 mr-2 text-blue-600" />
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={settings.startTime}
                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg font-medium"
                  />
                </div>
                
                <div className="space-y-3">
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                    <Clock className="w-4 h-4 mr-2 text-purple-600" />
                    End Time
                  </label>
                  <input
                    type="time"
                    value={settings.endTime}
                    onChange={(e) => handleInputChange('endTime', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 text-lg font-medium"
                  />
                </div>
              </div>

              {/* Timezone */}
              <div className="space-y-3">
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                  <Globe className="w-4 h-4 mr-2 text-green-600" />
                  Timezone
                </label>
                <select
                  value={settings.admintimezone}
                  onChange={(e) => handleInputChange('admintimezone', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 text-lg font-medium bg-white"
                >
                  {timezones.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>

              {/* Duration Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 mr-2 text-orange-600" />
                    Slot Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    step="5"
                    value={settings.slotDuration}
                    onChange={(e) => handleInputChange('slotDuration', parseInt(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 text-lg font-medium"
                  />
                </div>
                
                <div className="space-y-3">
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                    <Clock className="w-4 h-4 mr-2 text-teal-600" />
                    Buffer Between Slots (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    step="5"
                    value={settings.bufferBetweenSlots}
                    onChange={(e) => handleInputChange('bufferBetweenSlots', parseInt(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 text-lg font-medium"
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-6 border-t border-gray-100">
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-purple-700 focus:ring-4 focus:ring-blue-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {saving ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Saving Settings...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <Save className="w-5 h-5 mr-2" />
                      Save Configuration
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Stats Card */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6">
                <h3 className="text-xl font-bold text-white mb-1">Schedule Overview</h3>
                <p className="text-green-100 text-sm">Current configuration stats</p>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {calculateWorkingHours()}
                  </div>
                  <div className="text-sm text-gray-600">Working Hours Per Day</div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {calculateSlotsPerDay()}
                  </div>
                  <div className="text-sm text-gray-600">Available Slots Per Day</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 mb-1">
                    {settings.slotDuration + settings.bufferBetweenSlots}
                  </div>
                  <div className="text-sm text-gray-600">Minutes Per Slot (Including Buffer)</div>
                </div>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                Quick Tips
              </h4>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  Slot duration should match your typical appointment length
                </li>
                <li className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  Buffer time helps you prepare between appointments
                </li>
                <li className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  Choose your local timezone for accurate scheduling
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityAdmin;