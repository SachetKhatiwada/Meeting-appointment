'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Mail, MapPin, Video, Trash2, Edit3, CheckCircle, XCircle, AlertCircle, Globe } from 'lucide-react';

interface Appointment {
  _id: string;
  startTimeUTC: string;
  endTimeUTC: string;
  appointmentTitle: string;
  description: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  clientEmail: string;
  clientTimezone: string;
  googleMeetLink: string;
  remindersSent: {
    confirmation: boolean;
    oneHourBefore: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

const TIMEZONES = [
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

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200'
};

const STATUS_ICONS = {
  scheduled: Clock,
  completed: CheckCircle,
  cancelled: XCircle
};

export default function AppointmentAdmin() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimezone, setSelectedTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/appointment');
      const data = await response.json();
      setAppointments(data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteAppointment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this appointment?')) return;
    
    try {
      const response = await fetch(`/api/appointment/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setAppointments(appointments.filter(apt => apt._id !== id));
      }
    } catch (error) {
      console.error('Error deleting appointment:', error);
    }
  };

  const updateAppointmentStatus = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/appointment/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      if (response.ok) {
        const updatedAppointment = await response.json();
        setAppointments(appointments.map(apt => 
          apt._id === id ? updatedAppointment : apt
        ));
        setEditingId(null);
      }
    } catch (error) {
      console.error('Error updating appointment:', error);
    }
  };

  const updateReminders = async (id: string, reminderType: 'confirmation' | 'oneHourBefore') => {
    const appointment = appointments.find(apt => apt._id === id);
    if (!appointment) return;

    const updatedReminders = {
      ...appointment.remindersSent,
      [reminderType]: !appointment.remindersSent[reminderType]
    };

    try {
      const response = await fetch(`/api/appointment/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ remindersSent: updatedReminders }),
      });
      
      if (response.ok) {
        const updatedAppointment = await response.json();
        setAppointments(appointments.map(apt => 
          apt._id === id ? updatedAppointment : apt
        ));
      }
    } catch (error) {
      console.error('Error updating reminders:', error);
    }
  };

  const formatDateTime = (utcTime: string, timezone: string) => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(utcTime));
  };

  const getTimeOnly = (utcTime: string, timezone: string) => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(utcTime));
  };

  const isUpcoming = (startTime: string) => {
    return new Date(startTime) > new Date();
  };

  const sortedAppointments = [...appointments].sort((a, b) => 
    new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime()
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading appointments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Appointment Dashboard</h1>
              <p className="text-gray-600">Manage your appointments and client meetings</p>
            </div>
            
            {/* Timezone Selector */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
              <Globe className="w-5 h-5 text-gray-500" />
              <div>
                <label className="text-sm font-medium text-gray-700 block">Timezone</label>
                <select
                  value={selectedTimezone}
                  onChange={(e) => setSelectedTimezone(e.target.value)}
                  className="mt-1 bg-white border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{appointments.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {appointments.filter(apt => apt.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Scheduled</p>
                <p className="text-2xl font-bold text-gray-900">
                  {appointments.filter(apt => apt.status === 'scheduled').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Cancelled</p>
                <p className="text-2xl font-bold text-gray-900">
                  {appointments.filter(apt => apt.status === 'cancelled').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Appointments List */}
        <div className="space-y-6">
          {sortedAppointments.map((appointment) => {
            const StatusIcon = STATUS_ICONS[appointment.status];
            const isUpcomingAppointment = isUpcoming(appointment.startTimeUTC);
            
            return (
              <div
                key={appointment._id}
                className={`bg-white rounded-xl shadow-lg p-6 border-l-4 ${
                  isUpcomingAppointment ? 'border-l-blue-500' : 'border-l-gray-300'
                } hover:shadow-xl transition-shadow duration-200`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Main Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          {appointment.appointmentTitle}
                        </h3>
                        <p className="text-gray-600 mb-3">{appointment.description}</p>
                        
                        {/* Time and Date */}
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">
                              {formatDateTime(appointment.startTimeUTC, selectedTimezone)}
                            </span>
                            <span className="text-gray-500">
                              - {getTimeOnly(appointment.endTimeUTC, selectedTimezone)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-600">
                              Client TZ: {appointment.clientTimezone}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Status Badge */}
                      <div className="flex items-center gap-2">
                        {editingId === appointment._id ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value)}
                              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                            >
                              <option value="scheduled">Scheduled</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                            <button
                              onClick={() => updateAppointmentStatus(appointment._id, editStatus)}
                              className="bg-green-500 text-white px-3 py-1 rounded-md text-sm hover:bg-green-600"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="bg-gray-500 text-white px-3 py-1 rounded-md text-sm hover:bg-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${STATUS_COLORS[appointment.status]}`}>
                              <StatusIcon className="w-4 h-4" />
                              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                            </span>
                            <button
                              onClick={() => {
                                setEditingId(appointment._id);
                                setEditStatus(appointment.status);
                              }}
                              className="p-1 text-gray-500 hover:text-blue-600"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Client Info and Actions */}
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <a 
                          href={`mailto:${appointment.clientEmail}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {appointment.clientEmail}
                        </a>
                      </div>
                      
                      <a
                        href={appointment.googleMeetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-green-600 hover:text-green-800"
                      >
                        <Video className="w-4 h-4" />
                        Join Meeting
                      </a>
                    
                    </div>
                 <div className="mt-2 mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
  <p className="text-sm font-medium text-gray-600 mb-1">Meeting Link:</p>
  <a 
    href={appointment.googleMeetLink} 
    target="_blank" 
    rel="noopener noreferrer"
    className="text-blue-600 hover:text-blue-800 font-medium break-all"
  >
    {appointment.googleMeetLink}
  </a>
</div>
                    {/* Reminders */}
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={appointment.remindersSent.confirmation}
                          onChange={() => updateReminders(appointment._id, 'confirmation')}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-600">Confirmation sent</span>
                      </label>
                      
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={appointment.remindersSent.oneHourBefore}
                          onChange={() => updateReminders(appointment._id, 'oneHourBefore')}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-600">1-hour reminder sent</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => deleteAppointment(appointment._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete appointment"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {/* Upcoming indicator */}
                {isUpcomingAppointment && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-lg p-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>Upcoming appointment</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {appointments.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No appointments found</h3>
            <p className="text-gray-600">Your appointments will appear here once they are created.</p>
          </div>
        )}
      </div>
    </div>
  );
}