import React, { useState, useEffect } from 'react';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card';
import { Badge } from '@/components/atoms/badge';
import { AlertCircle, Save, X, ArrowLeft, Mail, Phone, Shield, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import type {  
  CreateUserRequest, 
  UpdateUserRequest, 
  UserFormData, 
  FormErrors,
  UserRole, 
  User
} from '../types/user.types';
import { 
  USER_ROLES, 
  DEPARTMENTS, 
  SPECIALIZATIONS, 
  LANGUAGES 
} from '../types/user.types';

interface UserFormProps {
  user?: User | null;
  isEditing?: boolean;
  onSave: (userData: CreateUserRequest | UpdateUserRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const UserForm: React.FC<UserFormProps> = ({
  user,
  isEditing = false,
  onSave,
  onCancel,
  isLoading = false
}) => {
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    firstName: '',
    lastName: '',
    role: 'student',
    phone: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);

  // Inicializar formulario
  useEffect(() => {
    if (user && isEditing) {
      setFormData({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.profile?.phone || '',
        department: user.teacherData?.department || '',
        experience: user.teacherData?.experience || 0,
        certificationLevel: user.proctorData?.certificationLevel || '',
        maxSimultaneousSessions: user.proctorData?.maxSimultaneousSessions || 1,
      });
      
      setSelectedSpecializations(user.teacherData?.specialization || []);
      setSelectedLanguages(user.proctorData?.languages || []);
    }
  }, [user, isEditing]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validaciones básicas
    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Formato de email inválido';
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'El nombre es requerido';
    } else if (formData.firstName.length < 2) {
      newErrors.firstName = 'El nombre debe tener al menos 2 caracteres';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'El apellido es requerido';
    } else if (formData.lastName.length < 2) {
      newErrors.lastName = 'El apellido debe tener al menos 2 caracteres';
    }

    if (!formData.role) {
      newErrors.role = 'El rol es requerido';
    }

    // Validaciones específicas por rol
    if (formData.role === 'teacher') {
      if (!formData.department?.trim()) {
        newErrors.department = 'El departamento es requerido para profesores';
      }
      if (selectedSpecializations.length === 0) {
        newErrors.specialization = 'Al menos una especialización es requerida';
      }
      if (formData.experience === undefined || formData.experience < 0) {
        newErrors.experience = 'La experiencia debe ser mayor o igual a 0';
      }
    }

    if (formData.role === 'proctor') {
      if (!formData.certificationLevel?.trim()) {
        newErrors.certificationLevel = 'El nivel de certificación es requerido';
      }
      if (selectedLanguages.length === 0) {
        newErrors.languages = 'Al menos un idioma es requerido';
      }
      if (!formData.maxSimultaneousSessions || formData.maxSimultaneousSessions < 1) {
        newErrors.maxSimultaneousSessions = 'Debe ser al menos 1 sesión simultánea';
      }
    }

    // Validación de teléfono
    if (formData.phone && formData.phone.length < 7) {
      newErrors.phone = 'El teléfono debe tener al menos 7 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const baseData = {
        email: formData.email.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        role: formData.role,
        profile: formData.phone ? { phone: formData.phone.trim() } : undefined,
      };

      let userData: CreateUserRequest | UpdateUserRequest;

      if (formData.role === 'teacher') {
        userData = {
          ...baseData,
          teacherData: {
            department: formData.department!,
            specialization: selectedSpecializations,
            experience: formData.experience || 0,
            certifications: [], // Se pueden agregar después
            schedule: [], // Se pueden agregar después
          },
        } as CreateUserRequest;
      } else if (formData.role === 'proctor') {
        userData = {
          ...baseData,
          proctorData: {
            availableHours: [], // Se pueden agregar después
            certificationLevel: formData.certificationLevel!,
            languages: selectedLanguages,
            maxSimultaneousSessions: formData.maxSimultaneousSessions || 1,
          },
        } as CreateUserRequest;
      } else {
        userData = baseData as CreateUserRequest;
      }

      await onSave(userData);
    } catch (error) {
      console.error('Error saving user:', error);
    }
  };

  const handleSpecializationToggle = (specialization: string) => {
    setSelectedSpecializations(prev => 
      prev.includes(specialization)
        ? prev.filter(s => s !== specialization)
        : [...prev, specialization]
    );
  };

  const handleLanguageToggle = (language: string) => {
    setSelectedLanguages(prev => 
      prev.includes(language)
        ? prev.filter(l => l !== language)
        : [...prev, language]
    );
  };

  const handleInputChange = (field: keyof UserFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpiar error del campo al cambiar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const selectedRoleConfig = USER_ROLES.find(r => r.value === formData.role);

  return (
    <div className="max-w-4xl mx-auto space-y-6  bg-box p-4 rounded-lg border border-line">
      {/* Header */}
      <div className="flex items-center gap-4 text-gray-200"> 
        <div>
          <h2 className="text-2xl font-bold text-gray-200">
            {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
          </h2>
          <p className="text-gray-500">
            {isEditing 
              ? `Modificando información de ${user?.firstName} ${user?.lastName}`
              : 'Completa la información para crear un nuevo usuario'
            }
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información básica */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="w-5 h-5" />
              Información Básica
            </CardTitle>
            <CardDescription>
              Datos personales del usuario
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  Email *
                </Label>
                <Input
                  id="email" 
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="usuario@ejemplo.com"
                  className={errors.email ? 'border-red-500' : "bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"}
                  disabled={isEditing} // No permitir cambiar email en edición
                />
                {errors.email && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errors.email}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Rol */}
              <div className="space-y-2">
                <Label htmlFor="role" className="flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  Rol *
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: UserRole) => handleInputChange('role', value)}
                >
                  <SelectTrigger className={errors.role ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent className='bg-gray-900 border border-line'>
                    {USER_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value} className='hover:bg-gray-800'>
                        <div>
                          <div className="font-medium">{role.label}</div>
                          <div className="text-sm text-gray-500">{role.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRoleConfig && (
                  <div className="text-sm text-gray-600">
                    {selectedRoleConfig.description}
                  </div>
                )}
                {errors.role && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errors.role}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="Juan"
                  className={errors.firstName ? 'border-red-500' : "bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"}
                />
                {errors.firstName && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errors.firstName}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Apellido */}
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellido *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Pérez"
                  className={errors.lastName ? 'border-red-500' : "bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"}
                />
                {errors.lastName && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errors.lastName}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            {/* Teléfono */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1">
                <Phone className="w-4 h-4" />
                Teléfono
              </Label>
              <Input
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="+591 70123456"
                className={errors.phone ? 'border-red-500' : "bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"}
              />
              {errors.phone && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.phone}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Información específica por rol */}
        {formData.role === 'teacher' && (
          <Card>
            <CardHeader>
              <CardTitle>Información del Profesor</CardTitle>
              <CardDescription>
                Datos específicos para el rol de profesor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Departamento */}
                <div className="space-y-2">
                  <Label htmlFor="department">Departamento *</Label>
                  <Select
                    value={formData.department || ''}
                    onValueChange={(value) => handleInputChange('department', value)}
                  >
                    <SelectTrigger className={errors.department ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Seleccionar departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.department && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{errors.department}</AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Experiencia */}
                <div className="space-y-2">
                  <Label htmlFor="experience">Años de experiencia</Label>
                  <Input
                    id="experience"
                    type="number"
                    min="0"
                    value={formData.experience || ''}
                    onChange={(e) => handleInputChange('experience', parseInt(e.target.value) || 0)}
                    placeholder="5"
                    className={errors.experience ? 'border-red-500' : "bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"}
                  />
                  {errors.experience && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{errors.experience}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              {/* Especializaciones */}
              <div className="space-y-2">
                <Label>Especializaciones *</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {SPECIALIZATIONS.map((specialization) => (
                    <div
                      key={specialization}
                      className={`p-2 border border-line rounded-lg cursor-pointer transition-colors ${
                        selectedSpecializations.includes(specialization)
                          ? 'bg-gray-700 text-white border-blue-500'
                          : '200 hover:bg-gray-800'
                      }`}
                      onClick={() => handleSpecializationToggle(specialization)}
                    >
                      <div className="text-sm font-medium">{specialization}</div>
                    </div>
                  ))}
                </div>
                {selectedSpecializations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedSpecializations.map((spec) => (
                      <Badge key={spec} variant="secondary" className="text-xs">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                )}
                {errors.specialization && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errors.specialization}</AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {formData.role === 'proctor' && (
          <Card className='border shadow-none border-line'>
            <CardHeader>
              <CardTitle>Información del Supervisor</CardTitle>
              <CardDescription>
                Datos específicos para el rol de supervisor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nivel de certificación */}
                <div className="space-y-2">
                  <Label htmlFor="certificationLevel">Nivel de certificación *</Label>
                  <Input
                    id="certificationLevel"
                    value={formData.certificationLevel || ''}
                    onChange={(e) => handleInputChange('certificationLevel', e.target.value)}
                    placeholder="Nivel de certificación"
                    className={errors.certificationLevel ? 'border-red-500' : "bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"}
                  />
                  {errors.certificationLevel && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{errors.certificationLevel}</AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Sesiones simultáneas */}
                <div className="space-y-2">
                  <Label htmlFor="maxSessions">Máximo de sesiones simultáneas</Label>
                  <Input
                    id="maxSessions"
                    type="number"
                    min="1"
                    max="10"
                    value={formData.maxSimultaneousSessions || ''}
                    onChange={(e) => handleInputChange('maxSimultaneousSessions', parseInt(e.target.value) || 1)}
                    placeholder="3"
                    className={errors.maxSimultaneousSessions ? 'border-red-500' : "bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"}
                  />
                  {errors.maxSimultaneousSessions && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{errors.maxSimultaneousSessions}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              {/* Idiomas */}
              <div className="space-y-2">
                <Label>Idiomas que maneja *</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {LANGUAGES.map((language) => (
                    <div
                      key={language}
                      className={`p-2 border border-line rounded-lg cursor-pointer transition-colors ${
                        selectedLanguages.includes(language)
                          ? 'bg-gray-700 text-white border-blue-500'
                          : '200 hover:bg-gray-800'
                      }`}
                      onClick={() => handleLanguageToggle(language)}
                    >
                      <div className="text-sm font-medium">{language}</div>
                    </div>
                  ))}
                </div>
                {selectedLanguages.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedLanguages.map((lang) => (
                      <Badge key={lang} variant="secondary" className="text-xs">
                        {lang}
                      </Badge>
                    ))}
                  </div>
                )}
                {errors.languages && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errors.languages}</AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botones de acción */}
        <div className="flex justify-end gap-3 pt-6 border-t border-line">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="gap-1 text-white bg-transparent border border-line hover:bg-gray-800"
          >
            <X className="w-4 h-4" />
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Save className="w-4 h-4" />
            {isLoading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear Usuario'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default UserForm;
