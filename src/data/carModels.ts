export interface CarModel {
  id: string;
  name: string;
  folderName: string;
  exportFileName: string;
  width?: number;
  height?: number;
}

export const carModels: CarModel[] = [
  {
    id: 'cybertruck',
    name: 'Cybertruck',
    folderName: 'cybertruck',
    exportFileName: 'tesla_cybertruck_wrap.png',
  },
  {
    id: 'model3',
    name: 'Model 3',
    folderName: 'model3',
    exportFileName: 'tesla_model_3_wrap.png',
  },
  {
    id: 'model3-2024-base',
    name: 'Model 3 (2024+) Standard & Premium',
    folderName: 'model3-2024-base',
    exportFileName: 'tesla_model_3_2024_wrap.png',
  },
  {
    id: 'model3-2024-performance',
    name: 'Model 3 (2024+) Performance',
    folderName: 'model3-2024-performance',
    exportFileName: 'tesla_model_3_2024_performance_wrap.png',
  },
  {
    id: 'modely',
    name: 'Model Y',
    folderName: 'modely',
    exportFileName: 'tesla_model_y_wrap.png',
  },
  {
    id: 'modely-2025-base',
    name: 'Model Y (2025+) Standard',
    folderName: 'modely-2025-base',
    exportFileName: 'tesla_model_y_2025_standard_wrap.png',
  },
  {
    id: 'modely-2025-premium',
    name: 'Model Y (2025+) Premium',
    folderName: 'modely-2025-premium',
    exportFileName: 'tesla_model_y_2025_premium_wrap.png',
  },
  {
    id: 'modely-2025-performance',
    name: 'Model Y (2025+) Performance',
    folderName: 'modely-2025-performance',
    exportFileName: 'tesla_model_y_2025_performance_wrap.png',
  },
  {
    id: 'modely-l',
    name: 'Model Y L',
    folderName: 'modely-l',
    exportFileName: 'tesla_model_y_l_wrap.png',
  },
];

export const defaultModel = carModels[4];

