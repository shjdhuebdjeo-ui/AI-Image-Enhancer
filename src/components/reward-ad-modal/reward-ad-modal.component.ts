import { Component, ChangeDetectionStrategy, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TokenService } from '../../services/token.service';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-reward-ad-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reward-ad-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RewardAdModalComponent {
  close = output<void>();
  adWatched = output<void>();
  
  tokenService = inject(TokenService);
  languageService = inject(LanguageService);

  t = this.languageService.t;
  
  isWatchingAd = signal(false);

  watchAd(): void {
    this.isWatchingAd.set(true);
    setTimeout(() => {
      this.tokenService.incrementTokens(1);
      this.isWatchingAd.set(false);
      this.adWatched.emit();
    }, 3000); // Simulate 3-second ad watch time
  }
}