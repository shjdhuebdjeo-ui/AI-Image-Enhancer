import { Injectable, signal, effect, computed, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { translations } from '../i18n/translations';

export type Language = 'en' | 'ar';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private readonly LANG_STORAGE_KEY = 'ai_image_enhancer_language';
  private isBrowser: boolean;

  language = signal<Language>(this.getInitialLanguage());
  
  // Computed signal for translations
  t = computed(() => translations[this.language()]);

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Effect to save language to localStorage whenever it changes
    effect(() => {
      if (this.isBrowser) {
        localStorage.setItem(this.LANG_STORAGE_KEY, this.language());
      }
    });
  }

  private getInitialLanguage(): Language {
    if (this.isBrowser) {
      const storedLang = localStorage.getItem(this.LANG_STORAGE_KEY);
      if (storedLang === 'en' || storedLang === 'ar') {
        return storedLang;
      }
    }
    return 'en'; // Default language
  }

  setLanguage(lang: Language): void {
    this.language.set(lang);
  }

  toggleLanguage(): void {
    this.language.update(current => current === 'en' ? 'ar' : 'en');
  }
}
