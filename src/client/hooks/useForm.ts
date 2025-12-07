/**
 * Veilleur - Hook useForm
 * Gestion de formulaires avec validation
 *
 * Fonctionnalités:
 * - Gestion d'état des champs
 * - Validation synchrone et asynchrone
 * - États touched/dirty
 * - Soumission avec loading
 * - Reset et valeurs initiales
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ============================================================
// TYPES
// ============================================================

type ValidationRule<T> = (value: T, values: Record<string, unknown>) => string | undefined | Promise<string | undefined>;

interface FieldConfig<T = unknown> {
  initialValue: T;
  validate?: ValidationRule<T> | ValidationRule<T>[];
  // Transformer la valeur avant stockage
  transform?: (value: T) => T;
  // Dépendances pour re-validation
  deps?: string[];
}

interface FieldState<T = unknown> {
  value: T;
  error: string | null;
  touched: boolean;
  dirty: boolean;
}

interface FormState {
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
  isValidating: boolean;
  submitCount: number;
  errors: Record<string, string | null>;
}

interface UseFormOptions<T extends Record<string, unknown>> {
  // Valeurs initiales
  initialValues: T;
  // Validation par champ
  validate?: {
    [K in keyof T]?: ValidationRule<T[K]> | ValidationRule<T[K]>[];
  };
  // Validation du formulaire entier
  validateForm?: (values: T) => Record<string, string> | Promise<Record<string, string>>;
  // Callback de soumission
  onSubmit?: (values: T) => void | Promise<void>;
  // Valider au blur
  validateOnBlur?: boolean;
  // Valider au change
  validateOnChange?: boolean;
  // Valider à la soumission
  validateOnSubmit?: boolean;
}

interface UseFormReturn<T extends Record<string, unknown>> {
  // Valeurs actuelles
  values: T;
  // Erreurs par champ
  errors: Record<keyof T, string | null>;
  // Champs touchés
  touched: Record<keyof T, boolean>;
  // Champs modifiés
  dirty: Record<keyof T, boolean>;
  // État du formulaire
  formState: FormState;
  // Setters
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setValues: (values: Partial<T>) => void;
  setError: <K extends keyof T>(field: K, error: string | null) => void;
  setTouched: <K extends keyof T>(field: K, touched?: boolean) => void;
  // Handlers
  handleChange: (field: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleBlur: (field: keyof T) => () => void;
  // Validation
  validateField: <K extends keyof T>(field: K) => Promise<string | null>;
  validateAll: () => Promise<boolean>;
  // Actions
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  reset: (values?: Partial<T>) => void;
  // Helpers
  getFieldProps: <K extends keyof T>(field: K) => {
    name: K;
    value: T[K];
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: () => void;
  };
  register: <K extends keyof T>(field: K) => {
    name: K;
    value: T[K];
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: () => void;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  };
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Exécute les règles de validation
 */
async function runValidation<T>(
  value: T,
  rules: ValidationRule<T> | ValidationRule<T>[] | undefined,
  values: Record<string, unknown>,
): Promise<string | null> {
  if (!rules) return null;

  const rulesArray = Array.isArray(rules) ? rules : [rules];

  for (const rule of rulesArray) {
    const error = await rule(value, values);
    if (error) return error;
  }

  return null;
}

/**
 * Crée l'état initial des champs
 */
function createInitialState<T extends Record<string, unknown>>(
  initialValues: T,
): {
  values: T;
  errors: Record<keyof T, string | null>;
  touched: Record<keyof T, boolean>;
  dirty: Record<keyof T, boolean>;
} {
  const errors = {} as Record<keyof T, string | null>;
  const touched = {} as Record<keyof T, boolean>;
  const dirty = {} as Record<keyof T, boolean>;

  for (const key of Object.keys(initialValues) as (keyof T)[]) {
    errors[key] = null;
    touched[key] = false;
    dirty[key] = false;
  }

  return { values: { ...initialValues }, errors, touched, dirty };
}

// ============================================================
// USE FORM
// ============================================================

/**
 * Hook pour gérer les formulaires
 * @param options - Options de configuration
 *
 * @example
 * const form = useForm({
 *   initialValues: { email: '', password: '' },
 *   validate: {
 *     email: (v) => !v ? 'Email requis' : !v.includes('@') ? 'Email invalide' : undefined,
 *     password: (v) => !v ? 'Mot de passe requis' : v.length < 8 ? 'Min 8 caractères' : undefined,
 *   },
 *   onSubmit: async (values) => {
 *     await login(values);
 *   },
 * });
 *
 * return (
 *   <form onSubmit={form.handleSubmit}>
 *     <input {...form.register('email')} />
 *     {form.errors.email && <span>{form.errors.email}</span>}
 *     <input type="password" {...form.register('password')} />
 *     {form.errors.password && <span>{form.errors.password}</span>}
 *     <button type="submit" disabled={form.formState.isSubmitting}>
 *       Connexion
 *     </button>
 *   </form>
 * );
 */
export function useForm<T extends Record<string, unknown>>(
  options: UseFormOptions<T>,
): UseFormReturn<T> {
  const {
    initialValues,
    validate = {},
    validateForm,
    onSubmit,
    validateOnBlur = true,
    validateOnChange = false,
    validateOnSubmit = true,
  } = options;

  const initialValuesRef = useRef(initialValues);

  // État
  const [values, setValuesState] = useState<T>(() => ({ ...initialValues }));
  const [errors, setErrors] = useState<Record<keyof T, string | null>>(
    () => createInitialState(initialValues).errors,
  );
  const [touched, setTouched] = useState<Record<keyof T, boolean>>(
    () => createInitialState(initialValues).touched,
  );
  const [dirty, setDirty] = useState<Record<keyof T, boolean>>(
    () => createInitialState(initialValues).dirty,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  // Calculer isValid et isDirty
  const isValid = useMemo(() => {
    return Object.values(errors).every(e => e === null);
  }, [errors]);

  const isDirty = useMemo(() => {
    return Object.values(dirty).some(d => d);
  }, [dirty]);

  const formState: FormState = useMemo(
    () => ({
      isValid,
      isDirty,
      isSubmitting,
      isValidating,
      submitCount,
      errors: errors as Record<string, string | null>,
    }),
    [isValid, isDirty, isSubmitting, isValidating, submitCount, errors],
  );

  // Validation d'un champ
  const validateField = useCallback(
    async <K extends keyof T>(field: K): Promise<string | null> => {
      const rules = validate[field];
      const error = await runValidation(values[field], rules as ValidationRule<T[K]> | ValidationRule<T[K]>[], values as Record<string, unknown>);
      setErrors(prev => ({ ...prev, [field]: error }));
      return error;
    },
    [validate, values],
  );

  // Validation de tous les champs
  const validateAll = useCallback(async (): Promise<boolean> => {
    setIsValidating(true);

    const newErrors = { ...errors };
    let isFormValid = true;

    // Valider chaque champ
    for (const field of Object.keys(values) as (keyof T)[]) {
      const rules = validate[field];
      const error = await runValidation(
        values[field],
        rules as ValidationRule<T[typeof field]> | ValidationRule<T[typeof field]>[],
        values as Record<string, unknown>,
      );
      newErrors[field] = error;
      if (error) isFormValid = false;
    }

    // Validation du formulaire entier
    if (validateForm && isFormValid) {
      const formErrors = await validateForm(values);
      for (const [field, error] of Object.entries(formErrors)) {
        if (error) {
          newErrors[field as keyof T] = error;
          isFormValid = false;
        }
      }
    }

    setErrors(newErrors);
    setIsValidating(false);
    return isFormValid;
  }, [errors, validate, validateForm, values]);

  // Setters
  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValuesState(prev => ({ ...prev, [field]: value }));
    setDirty(prev => ({
      ...prev,
      [field]: value !== initialValuesRef.current[field],
    }));

    if (validateOnChange) {
      // Valider de manière asynchrone
      setTimeout(() => {
        void runValidation(
          value,
          validate[field] as ValidationRule<T[K]> | ValidationRule<T[K]>[],
          { ...values, [field]: value } as Record<string, unknown>,
        ).then(error => {
          setErrors(prev => ({ ...prev, [field]: error }));
        });
      }, 0);
    }
  }, [validate, validateOnChange, values]);

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState(prev => ({ ...prev, ...newValues }));
    setDirty(prev => {
      const newDirty = { ...prev };
      for (const key of Object.keys(newValues) as (keyof T)[]) {
        newDirty[key] = newValues[key] !== initialValuesRef.current[key];
      }
      return newDirty;
    });
  }, []);

  const setError = useCallback(<K extends keyof T>(field: K, error: string | null) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const setTouchedField = useCallback(<K extends keyof T>(field: K, isTouched = true) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }));
  }, []);

  // Handlers
  const handleChange = useCallback(
    (field: keyof T) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { type } = e.target as HTMLInputElement;
        let value: unknown;

        if (type === 'checkbox') {
          value = (e.target as HTMLInputElement).checked;
        } else if (type === 'number') {
          value = e.target.value === '' ? '' : Number(e.target.value);
        } else {
          value = e.target.value;
        }

        setValue(field, value as T[keyof T]);
      },
    [setValue],
  );

  const handleBlur = useCallback(
    (field: keyof T) => () => {
      setTouchedField(field, true);

      if (validateOnBlur) {
        void validateField(field);
      }
    },
    [setTouchedField, validateField, validateOnBlur],
  );

  // Soumission
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      setSubmitCount(prev => prev + 1);

      // Marquer tous les champs comme touched
      const allTouched = {} as Record<keyof T, boolean>;
      for (const key of Object.keys(values) as (keyof T)[]) {
        allTouched[key] = true;
      }
      setTouched(allTouched);

      // Valider si nécessaire
      if (validateOnSubmit) {
        const isFormValid = await validateAll();
        if (!isFormValid) return;
      }

      // Soumettre
      if (onSubmit) {
        setIsSubmitting(true);
        try {
          await onSubmit(values);
        } finally {
          setIsSubmitting(false);
        }
      }
    },
    [onSubmit, validateAll, validateOnSubmit, values],
  );

  // Reset
  const reset = useCallback((newValues?: Partial<T>) => {
    const resetValues = newValues
      ? { ...initialValuesRef.current, ...newValues }
      : { ...initialValuesRef.current };

    setValuesState(resetValues as T);
    setErrors(createInitialState(resetValues as T).errors);
    setTouched(createInitialState(resetValues as T).touched);
    setDirty(createInitialState(resetValues as T).dirty);
    setSubmitCount(0);
  }, []);

  // Helpers
  const getFieldProps = useCallback(
    <K extends keyof T>(field: K) => ({
      name: field,
      value: values[field],
      onChange: handleChange(field),
      onBlur: handleBlur(field),
    }),
    [handleBlur, handleChange, values],
  );

  const register = useCallback(
    <K extends keyof T>(field: K) => ({
      name: field,
      value: values[field],
      onChange: handleChange(field),
      onBlur: handleBlur(field),
      'aria-invalid': !!errors[field] && touched[field],
      'aria-describedby': errors[field] ? `${String(field)}-error` : undefined,
    }),
    [errors, handleBlur, handleChange, touched, values],
  );

  return {
    values,
    errors,
    touched,
    dirty,
    formState,
    setValue,
    setValues,
    setError,
    setTouched: setTouchedField,
    handleChange,
    handleBlur,
    validateField,
    validateAll,
    handleSubmit,
    reset,
    getFieldProps,
    register,
  };
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Validateur: champ requis
 */
export function requis(message = 'Ce champ est requis'): ValidationRule<unknown> {
  return (value) => {
    if (value === undefined || value === null || value === '') {
      return message;
    }
    return undefined;
  };
}

/**
 * Validateur: longueur minimum
 */
export function longueurMin(min: number, message?: string): ValidationRule<string> {
  return (value) => {
    if (value && value.length < min) {
      return message ?? `Minimum ${min} caractères`;
    }
    return undefined;
  };
}

/**
 * Validateur: longueur maximum
 */
export function longueurMax(max: number, message?: string): ValidationRule<string> {
  return (value) => {
    if (value && value.length > max) {
      return message ?? `Maximum ${max} caractères`;
    }
    return undefined;
  };
}

/**
 * Validateur: format email
 */
export function email(message = 'Email invalide'): ValidationRule<string> {
  return (value) => {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return message;
    }
    return undefined;
  };
}

/**
 * Validateur: pattern regex
 */
export function pattern(regex: RegExp, message = 'Format invalide'): ValidationRule<string> {
  return (value) => {
    if (value && !regex.test(value)) {
      return message;
    }
    return undefined;
  };
}

/**
 * Validateur: valeur minimum (nombres)
 */
export function valeurMin(min: number, message?: string): ValidationRule<number> {
  return (value) => {
    if (value !== undefined && value < min) {
      return message ?? `Minimum ${min}`;
    }
    return undefined;
  };
}

/**
 * Validateur: valeur maximum (nombres)
 */
export function valeurMax(max: number, message?: string): ValidationRule<number> {
  return (value) => {
    if (value !== undefined && value > max) {
      return message ?? `Maximum ${max}`;
    }
    return undefined;
  };
}

/**
 * Validateur: correspondance avec un autre champ
 */
export function correspondA<T>(
  fieldName: string,
  message = 'Les valeurs ne correspondent pas',
): ValidationRule<T> {
  return (value, values) => {
    if (value !== values[fieldName]) {
      return message;
    }
    return undefined;
  };
}

/**
 * Combine plusieurs validateurs
 */
export function combiner<T>(...validators: ValidationRule<T>[]): ValidationRule<T>[] {
  return validators;
}

// ============================================================
// EXPORTS
// ============================================================

export default useForm;
