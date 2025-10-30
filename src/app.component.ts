import { Component, ChangeDetectionStrategy, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RewardAdModalComponent } from './components/reward-ad-modal/reward-ad-modal.component';
import { TokenService } from './services/token.service';
import { ImageEnhancerService } from './services/image-enhancer.service';
import { LanguageService } from './services/language.service';
import { take } from 'rxjs';
import { ImageComparatorComponent } from './components/image-comparator/image-comparator.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RewardAdModalComponent, ImageComparatorComponent],
})
export class AppComponent {
  tokenService = inject(TokenService);
  imageEnhancerService = inject(ImageEnhancerService);
  languageService = inject(LanguageService);

  originalImage = signal<string | null>(null);
  enhancedImage = signal<string | null>(null);
  selectedFile = signal<File | null>(null);
  isEnhancing = signal(false);
  showRewardModal = signal(false);

  tokens = this.tokenService.tokens;
  t = this.languageService.t;
  currentLang = this.languageService.language;

  constructor() {
    effect(() => {
      const lang = this.currentLang();
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    });
  }

  handleFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.type.startsWith('image/')) {
        this.selectedFile.set(file);

        // Revoke the old object URL if it exists to prevent memory leaks
        const currentEnhancedUrl = this.enhancedImage();
        if (currentEnhancedUrl && currentEnhancedUrl.startsWith('blob:')) {
          URL.revokeObjectURL(currentEnhancedUrl);
        }
        
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          this.originalImage.set(e.target?.result as string);
          this.enhancedImage.set(null); // Reset enhanced image on new upload
        };
        reader.readAsDataURL(file);
      } else {
        alert('Please select a valid image file.');
      }
    }
  }

  handleEnhance(): void {
    const file = this.selectedFile();
    if (!file) {
      return;
    }
    
    if (this.tokens() <= 0) {
      this.showRewardModal.set(true);
      return;
    }
    
    this.tokenService.decrementTokens(1);
    this.isEnhancing.set(true);
    this.enhancedImage.set(null);

    this.imageEnhancerService.enhanceImage(file)
      .pipe(take(1))
      .subscribe({
        next: enhancedImageUrl => {
          this.enhancedImage.set(enhancedImageUrl);
          this.isEnhancing.set(false);
        },
        error: (err) => {
          console.error('Enhancement failed in component:', err);
          // Reset the enhancing state on error
          this.isEnhancing.set(false);
        }
      });
  }

  reset(): void {
    // Revoke the old object URL if it exists to prevent memory leaks
    const currentEnhancedUrl = this.enhancedImage();
    if (currentEnhancedUrl && currentEnhancedUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentEnhancedUrl);
    }
    this.originalImage.set(null);
    this.enhancedImage.set(null);
    this.selectedFile.set(null);
  }

  downloadImage(): void {
    const url = this.enhancedImage();
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'enhanced-image.png'; // The model returns a png
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  closeRewardModal(): void {
    this.showRewardModal.set(false);
  }

  handleAdWatched(): void {
    this.showRewardModal.set(false);
    this.handleEnhance();
  }

  toggleLanguage(): void {
    this.languageService.toggleLanguage();
  }
}