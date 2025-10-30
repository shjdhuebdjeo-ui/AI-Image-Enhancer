import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { map, catchError, switchMap, filter, take, timeout, tap } from 'rxjs';
import { environment } from '../environments/environment';

// Define interfaces for Replicate API responses for strong typing
interface ReplicatePredictionRequest {
  version: string;
  input: {
    [key: string]: any;
  };
}

interface ReplicatePredictionResponse {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  urls: {
    get: string;
    cancel: string;
  };
  output?: any;
  error?: any;
}


@Injectable({
  providedIn: 'root'
})
export class ImageEnhancerService {
  // As requested, the API URL is set to use the Netlify proxy path.
  private readonly REPLICATE_API_URL = '/api/predictions';
  // Model: nightmareai/real-esrgan
  private readonly MODEL_VERSION = '4f20845348825fcb41e9d1a38f32230da37f818f2d011f0a2007a3c39050d032';
  
  private http = inject(HttpClient);

  /**
   * Converts a File object to a base64 encoded data URL string.
   * @param file The file to convert.
   * @returns An Observable that emits the data URL.
   */
  private fileToBase64(file: File): Observable<string> {
    return new Observable(observer => {
      const reader = new FileReader();
      reader.onload = () => {
        observer.next(reader.result as string);
        observer.complete();
      };
      reader.onerror = error => {
        observer.error(error);
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Enhances an image by calling the Replicate API.
   * This involves a two-step process:
   * 1. Start the prediction job.
   * 2. Poll for the result.
   * @param image The image file to enhance.
   * @returns An Observable that emits a blob object URL to the enhanced image.
   */
  enhanceImage(image: File): Observable<string> {
    // As requested, the API token is read from the Angular environment configuration.
    const apiToken = environment.REPLICATE_API_TOKEN;

    if (!apiToken || apiToken.startsWith('r8_') === false) {
      const errorMessage = 'Replicate API token is not configured. Please set the REPLICATE_API_TOKEN in src/environments/environment.ts';
      console.error(errorMessage);
      alert('Configuration error: The Replicate API key is missing or invalid. The application cannot enhance images.');
      return throwError(() => new Error(errorMessage));
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Token ${apiToken}`,
      'Content-Type': 'application/json'
    });

    return this.fileToBase64(image).pipe(
      // Step 1: Create the prediction job on Replicate using a direct HTTP POST request with HttpClient.
      switchMap(base64Image => {
        // The fileToBase64 function returns a full Data URI string (e.g., "data:image/png;base64,...").
        // This is the correct format required by the Replicate API's `input.image` field.
        const body: ReplicatePredictionRequest = {
          version: this.MODEL_VERSION,
          input: { image: base64Image }
        };
        console.log('Starting Replicate prediction via Netlify proxy...');
        return this.http.post<ReplicatePredictionResponse>(this.REPLICATE_API_URL, body, { headers });
      }),
      // Step 2: Poll the 'get' URL for the prediction result using direct HTTP GET requests.
      // FIX: Explicitly type `predictionResponse` to avoid it being inferred as `unknown`.
      switchMap((predictionResponse: ReplicatePredictionResponse) => {
        if (!predictionResponse.urls || !predictionResponse.urls.get) {
            return throwError(() => new Error('Failed to get polling URL from Replicate.'));
        }
        
        // The polling URL from Replicate is absolute, so we convert it to a relative path
        // to be routed through the Netlify proxy.
        const pollingUrl = predictionResponse.urls.get.replace('https://api.replicate.com/v1', '/api');
        const poll$ = this.http.get<ReplicatePredictionResponse>(pollingUrl, { headers });

        return timer(0, 2500).pipe( // Poll every 2.5 seconds
          tap(() => console.log('Polling for Replicate result via Netlify proxy...')),
          switchMap(() => poll$),
          // FIX: Explicitly type `res` to avoid it being inferred as `unknown`.
          filter((res: ReplicatePredictionResponse) => ['succeeded', 'failed', 'canceled'].includes(res.status)),
          take(1),
          timeout(180000) // 3 minute timeout for the whole polling process
        );
      }),
      // Step 3: Process the final response from polling
      // FIX: Explicitly type `finalResponse` to avoid it being inferred as `unknown`.
      switchMap((finalResponse: ReplicatePredictionResponse) => {
        if (finalResponse.status === 'succeeded' && finalResponse.output) {
          console.log('Replicate prediction succeeded.');
          // The output is often an array, get the first image URL.
          const imageUrl = Array.isArray(finalResponse.output) ? finalResponse.output[0] : finalResponse.output;
          
          // IMPORTANT: The final image is on a different domain (e.g., replicate.delivery)
          // which is not covered by the Netlify proxy for api.replicate.com.
          // We must use a general CORS proxy here to fetch the image blob data.
          const proxiedImageUrl = `https://thingproxy.freeboard.io/fetch/${imageUrl}`;
          return this.http.get(proxiedImageUrl, { responseType: 'blob' });
        } else {
          const errorMsg = `Replicate processing failed with status: ${finalResponse.status}. Error: ${JSON.stringify(finalResponse.error)}`;
          return throwError(() => new Error(errorMsg));
        }
      }),
      // Step 4: Convert the final image blob to an object URL for the component
      // FIX: Explicitly type `imageBlob` to `Blob` to fix `createObjectURL` parameter error.
      map((imageBlob: Blob) => {
        console.log('Enhanced image blob received, creating object URL.');
        return URL.createObjectURL(imageBlob);
      }),
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse | Error): Observable<never> {
    let userMessage = 'Failed to enhance the image. The AI model might be unavailable or another error occurred. Please try again later.';
    
    if (error instanceof HttpErrorResponse) {
        if (error.status === 401 || error.status === 403) {
            userMessage = 'Authentication failed. Please ensure your Replicate API token is valid and has the correct permissions.';
        } else if (error.status === 422) {
            userMessage = 'The AI model could not process the image. It might be an unsupported format or corrupted. Please try a different image.';
            console.error('Unprocessable Entity (422) Error. API response:', JSON.stringify(error.error, null, 2));
        } else if (error.status === 0) {
            userMessage = 'A network error occurred. This could be a CORS issue or a problem with your connection. The app has been configured to use a Netlify proxy to prevent this.'
        }
        console.error(`An error occurred during image enhancement: HTTP ${error.status} ${error.statusText}`, error);
    } else {
        console.error('An error occurred during image enhancement:', error.message);
    }

    alert(userMessage);
    return throwError(() => new Error('Image enhancement failed.'));
  }
}
