export type FormControlType = 'text' | 'dropdown' | 'radio' | 'number' | 'date';

export interface FormOption {
  value: string | number;
  label: string;
}

export interface FormSchemaProperty {
  key: string;
  label: string;
  description?: string;
  controlType: FormControlType;
  required?: boolean;
  options?: FormOption[];
  default?: string | number;
}

export interface FormSchema {
  properties: FormSchemaProperty[];
}
