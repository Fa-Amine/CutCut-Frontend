import { HomeApplication } from '../../../core/services/private-home-service.service';
export const HOME_FILE_FIELDS = ['selfie', 'diploma', 'cinFront', 'cinBack'] as const;
export type HomeFileField = typeof HOME_FILE_FIELDS[number];
export function homePhotoError(file: Pick<File, 'size' | 'type'>): string {
  if (!file.size || file.size > 5 * 1024 * 1024) return 'Chaque photo doit être non vide et faire au maximum 5 Mo.';
  if (!['image/jpeg', 'image/png'].includes(file.type)) return 'Utilise une photo JPEG ou PNG, pas un PDF.';
  return '';
}
export function validHomeApplication(data: Partial<HomeApplication>): data is HomeApplication {
  return !!data.city?.trim() && data.city.trim().length <= 100 &&
    Number.isInteger(data.experienceYears) && data.experienceYears! >= 0 && data.experienceYears! <= 80 &&
    !!data.experienceDescription?.trim() && data.experienceDescription.trim().length <= 2000 &&
    HOME_FILE_FIELDS.every(field => !!data[field] && !homePhotoError(data[field]!));
}
