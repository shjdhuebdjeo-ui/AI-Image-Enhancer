import { Component, ChangeDetectionStrategy, input, signal, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-comparator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-comparator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(mousedown)': 'onDragStart($event)',
    '(touchstart)': 'onDragStart($event)',
    '(window:mousemove)': 'onDragMove($event)',
    '(window:touchmove)': 'onDragMove($event)',
    '(window:mouseup)': 'onDragEnd($event)',
    '(window:touchend)': 'onDragEnd($event)',
  },
})
export class ImageComparatorComponent {
  before = input.required<string>();
  after = input.required<string>();

  sliderPosition = signal(50);
  isDragging = signal(false);

  public hostElement = inject(ElementRef).nativeElement as HTMLElement;

  onDragStart(event: MouseEvent | TouchEvent): void {
    // Prevent default behavior like image dragging
    event.preventDefault();
    this.isDragging.set(true);
    this.updateSliderPosition(event);
  }

  onDragMove(event: MouseEvent | TouchEvent): void {
    if (this.isDragging()) {
      this.updateSliderPosition(event);
    }
  }

  onDragEnd(event: MouseEvent | TouchEvent): void {
    this.isDragging.set(false);
  }

  private updateSliderPosition(event: MouseEvent | TouchEvent): void {
    const rect = this.hostElement.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    
    let x = clientX - rect.left;
    // Clamp the value between 0 and the width of the container
    x = Math.max(0, Math.min(x, rect.width));
    
    const percent = (x / rect.width) * 100;
    this.sliderPosition.set(percent);
  }
}