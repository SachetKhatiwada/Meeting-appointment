"use client";
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Mail, FileText, Check, X, Globe } from 'lucide-react';

const AppointmentBooking = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null); // This will be UTC time
  const [selectedDisplayTime, setSelectedDisplayTime] = useState<string | null>(null); // This will be display time
  const [timeSlots, setTimeSlots] = useState<string[]>([]); // UTC time slots from API
  const [displayTimeSlots, setDisplayTimeSlots] = useState<{utc: string, display: string, date: Date}[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  
  const [formData, setFormData] = useState({
    appointmentTitle: '',
    description: '',
    clientEmail: '',
    clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Convert UTC time slot to user's timezone
  const convertUTCToUserTimezone = (utcTime: string, date: Date, timezone: string) => {
    // Create a Date object with the selected date and UTC time
    const [hours, minutes] = utcTime.split(':').map(Number);
    const utcDateTime = new Date(date);
    utcDateTime.setUTCHours(hours, minutes, 0, 0);
    
    // Convert to user's timezone
    const userDateTime = new Date(utcDateTime.toLocaleString("en-US", {timeZone: timezone}));
    
    return {
      displayTime: utcDateTime.toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }),
      fullDateTime: utcDateTime
    };
  };

  // Convert user's selected time back to UTC for API
  const convertUserTimeToUTC = (displayTime: string, date: Date, timezone: string) => {
    const [hours, minutes] = displayTime.split(':').map(Number);
    const userDateTime = new Date(date);
    userDateTime.setHours(hours, minutes, 0, 0);
    
    // Convert to UTC
    const utcDateTime = new Date(userDateTime.toLocaleString("en-US", {timeZone: "UTC"}));
    return utcDateTime;
  };

  // Get calendar days for current month
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  // Check if date is in past
  interface Notification {
    type: 'success' | 'error';
    message: string;
  }

  interface FormData {
    appointmentTitle: string;
    description: string;
    clientEmail: string;
    clientTimezone: string;
  }

  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  // Fetch time slots for selected date
  interface TimeSlotsResponse {
    timeSlots: string[];
    date: string;
    timezone: string;
  }

  const fetchTimeSlots = async (date: Date): Promise<void> => {
    if (!date || isPastDate(date)) return;
    
    setLoading(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      const response = await fetch(`/api/getTimeSlots?date=${dateStr}`);
      const data: TimeSlotsResponse = await response.json();
      
      if (data.timeSlots) {
        setTimeSlots(data.timeSlots); // Store UTC times
        
        // Convert UTC times to user's timezone for display
        const convertedSlots = data.timeSlots.map(utcTime => {
          const converted = convertUTCToUserTimezone(utcTime, date, formData.clientTimezone);
          return {
            utc: utcTime,
            display: converted.displayTime,
            date: converted.fullDateTime
          };
        }).filter(slot => {
          // Filter out past times if the selected date is today
          if (date.toDateString() === new Date().toDateString()) {
            return slot.date > new Date();
          }
          return true;
        }).sort((a, b) => a.date.getTime() - b.date.getTime());
        
        setDisplayTimeSlots(convertedSlots);
      } else {
        setTimeSlots([]);
        setDisplayTimeSlots([]);
      }
    } catch (error) {
      console.error('Error fetching time slots:', error);
      setTimeSlots([]);
      setDisplayTimeSlots([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle date selection
  interface HandleDateSelect {
    (date: Date): void;
  }

  const handleDateSelect: HandleDateSelect = (date) => {
    if (isPastDate(date)) return;
    
    setSelectedDate(date);
    setSelectedTime(null);
    setSelectedDisplayTime(null);
    setShowBookingForm(false);
    fetchTimeSlots(date);
  };

  // Handle time selection
  interface HandleTimeSelect {
    (utcTime: string, displayTime: string): void;
  }

  const handleTimeSelect: HandleTimeSelect = (utcTime, displayTime) => {
    setSelectedTime(utcTime); // Store UTC time for API
    setSelectedDisplayTime(displayTime); // Store display time for UI
    setShowBookingForm(true);
  };

  // Handle timezone change
  const handleTimezoneChange = (newTimezone: string) => {
    setFormData({...formData, clientTimezone: newTimezone});
    
    // Re-convert existing time slots if we have them
    if (selectedDate && timeSlots.length > 0) {
      const convertedSlots = timeSlots.map(utcTime => {
        const converted = convertUTCToUserTimezone(utcTime, selectedDate, newTimezone);
        return {
          utc: utcTime,
          display: converted.displayTime,
          date: converted.fullDateTime
        };
      }).filter(slot => {
        // Filter out past times if the selected date is today
        if (selectedDate.toDateString() === new Date().toDateString()) {
          return slot.date > new Date();
        }
        return true;
      }).sort((a, b) => a.date.getTime() - b.date.getTime());
      
      setDisplayTimeSlots(convertedSlots);
      
      // Update selected display time if there's a selection
      if (selectedTime) {
        const newDisplayTime = convertUTCToUserTimezone(selectedTime, selectedDate, newTimezone).displayTime;
        setSelectedDisplayTime(newDisplayTime);
      }
    }
  };

  // Handle form submission
  const handleBookAppointment = async () => {
    if (!selectedDate || !selectedTime) return;
    if (!formData.appointmentTitle || !formData.clientEmail) {
      setNotification({
        type: 'error',
        message: 'Please fill in all required fields'
      });
      return;
    }

    setBookingLoading(true);
    try {
      // Create UTC datetime from selected date and UTC time
      const [hours, minutes] = selectedTime.split(':');
      const appointmentDateTime = new Date(selectedDate);
      appointmentDateTime.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const response = await fetch('/api/appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startTimeUTC: appointmentDateTime.toISOString(),
          appointmentTitle: formData.appointmentTitle,
          description: formData.description,
          clientEmail: formData.clientEmail,
          clientTimezone: formData.clientTimezone,
        }),
      });
      
      console.log("Request body:", appointmentDateTime.toISOString());
      console.log("Response:", response);
      
      if (response.ok) {
        setNotification({
          type: 'success',
          message: 'Appointment booked successfully! Check your email for confirmation.'
        });
        // Reset form
        setFormData({
          appointmentTitle: '',
          description: '',
          clientEmail: '',
          clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
        setSelectedDate(null);
        setSelectedTime(null);
        setSelectedDisplayTime(null);
        setShowBookingForm(false);
        setTimeSlots([]);
        setDisplayTimeSlots([]);
      } else {
        const errorData = await response.json();
        setNotification({
          type: 'error',
          message: errorData.error || 'Failed to book appointment'
        });
      }
    } catch (error) {
      setNotification({
        type: 'error',
        message: 'Network error. Please try again.'
      });
    } finally {
      setBookingLoading(false);
    }
  };

  // Navigation handlers
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  // Close notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const calendarDays = getCalendarDays();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border-l-4 ${
          notification.type === 'success' 
            ? 'bg-green-50 border-green-500 text-green-800'
            : 'bg-red-50 border-red-500 text-red-800'
        } flex items-center gap-3 max-w-md`}>
          {notification.type === 'success' ? <Check size={20} /> : <X size={20} />}
          <span>{notification.message}</span>
          <button 
            onClick={() => setNotification(null)}
            className="ml-auto text-gray-500 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
            <Calendar className="text-blue-600" size={40} />
            Book Your Appointment
          </h1>
          <p className="text-gray-600 text-lg">Select a date and time that works best for you</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Calendar Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={goToPreviousMonth}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ChevronLeft size={24} className="text-gray-600" />
                </button>
                <h2 className="text-2xl font-semibold text-gray-800">
                  {months[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <button
                  onClick={goToNextMonth}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ChevronRight size={24} className="text-gray-600" />
                </button>
              </div>

              {/* Days of week */}
              <div className="grid grid-cols-7 gap-2 mb-4">
                {days.map(day => (
                  <div key={day} className="text-center text-gray-500 font-medium py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((date, index) => {
                  const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                  const isToday = date.toDateString() === new Date().toDateString();
                  const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                  const isPast = isPastDate(date);

                  return (
                    <button
                      key={index}
                      onClick={() => handleDateSelect(date)}
                      disabled={isPast || !isCurrentMonth}
                      className={`p-3 rounded-lg transition-all duration-200 ${
                        isPast || !isCurrentMonth
                          ? 'text-gray-300 cursor-not-allowed'
                          : isSelected
                          ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                          : isToday
                          ? 'bg-blue-100 text-blue-800 font-semibold hover:bg-blue-200'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slots */}
            {selectedDate && (
              <div className="bg-white rounded-2xl shadow-xl p-6 mt-6 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <Clock className="text-blue-600" size={24} />
                    Available Times for {selectedDate.toLocaleDateString()}
                  </h3>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Globe size={16} />
                                        <select
                      value={formData.clientTimezone}
                      onChange={(e) => handleTimezoneChange(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Asia/Kathmandu">Asia/Kathmandu</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="America/Los_Angeles">America/Los_Angeles</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="Europe/Paris">Europe/Paris</option>
                      <option value="Asia/Tokyo">Asia/Tokyo</option>
                      <option value="Australia/Sydney">Australia/Sydney</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
                
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : displayTimeSlots.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {displayTimeSlots.map((slot) => (
                      <button
                        key={slot.utc}
                        onClick={() => handleTimeSelect(slot.utc, slot.display)}
                        className={`p-3 rounded-lg border transition-all duration-200 ${
                          selectedDisplayTime === slot.display
                            ? 'bg-blue-600 text-white border-blue-600 shadow-lg transform scale-105'
                            : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-700'
                        }`}
                      >
                        {slot.display}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No available time slots for this date</p>
                )}
              </div>
            )}
          </div>

          {/* Booking Form */}
          <div className="lg:col-span-1">
            {showBookingForm && (
              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 sticky top-4">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <User className="text-blue-600" size={24} />
                  Appointment Details
                </h3>
                
                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Selected Time:</p>
                  <p className="font-semibold text-gray-800">
                    {selectedDate?.toLocaleDateString()} at {selectedDisplayTime}
                  </p>
                  <p className="text-xs text-gray-500">
                    ({formData.clientTimezone})
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Appointment Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.appointmentTitle}
                      onChange={(e) => setFormData({...formData, appointmentTitle: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Brief title for your appointment"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Mail size={16} />
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.clientEmail}
                      onChange={(e) => setFormData({...formData, clientEmail: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="your@email.com"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <FileText size={16} />
                      Description (Optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows={3}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Any additional details or notes..."
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Globe size={16} />
                      Your Timezone
                    </label>
                    <select
                      value={formData.clientTimezone}
                      onChange={(e) => handleTimezoneChange(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Asia/Kathmandu">Asia/Kathmandu</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="America/Los_Angeles">America/Los_Angeles</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="Europe/Paris">Europe/Paris</option>
                      <option value="Asia/Tokyo">Asia/Tokyo</option>
                      <option value="Australia/Sydney">Australia/Sydney</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleBookAppointment}
                    disabled={bookingLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {bookingLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Booking...
                      </>
                    ) : (
                      <>
                        <Check size={20} />
                        Book Appointment
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {!showBookingForm && (
              <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl p-6 text-center">
                <Calendar className="mx-auto text-blue-600 mb-4" size={48} />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Ready to Schedule?</h3>
                <p className="text-gray-600">Select a date and time to get started with your appointment booking.</p>
                <div className="mt-4 text-sm text-gray-500 flex items-center justify-center gap-1">
                  <Globe size={16} />
                  <span>Your timezone: {formData.clientTimezone}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentBooking;