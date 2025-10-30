
import { Injectable, signal, effect, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private readonly TOKEN_STORAGE_KEY = 'ai_image_enhancer_tokens';
  private isBrowser: boolean;

  tokens = signal<number>(this.getInitialTokens());
  
  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Effect to save tokens to localStorage whenever they change
    effect(() => {
      if (this.isBrowser) {
        localStorage.setItem(this.TOKEN_STORAGE_KEY, this.tokens().toString());
      }
    });
  }

  private getInitialTokens(): number {
    if (this.isBrowser) {
      const storedTokens = localStorage.getItem(this.TOKEN_STORAGE_KEY);
      return storedTokens ? parseInt(storedTokens, 10) : 1;
    }
    return 1;
  }

  incrementTokens(amount: number): void {
    this.tokens.update(current => current + amount);
  }

  decrementTokens(amount: number): void {
    this.tokens.update(current => Math.max(0, current - amount));
  }
}