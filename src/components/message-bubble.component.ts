import { Component, input, computed, signal, effect, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage, GeminiService } from '../services/gemini.service';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full mb-6 group flex" 
         [class.justify-start]="isUser()" 
         [class.justify-end]="!isUser()">
      
      <!-- ================= USER LAYOUT (Bubble) ================= -->
      @if (isUser()) {
        <div class="max-w-[85%] sm:max-w-[75%] flex flex-col items-start">
          <div class="rounded-2xl rounded-tr-none px-5 py-3 shadow-md bg-gradient-to-br from-orange-500 to-amber-500 text-white relative">
            @if (message().fileData; as file) {
              <div class="mb-2 p-2 rounded-lg flex items-center gap-3 bg-black/10 border border-white/10">
                <div class="w-8 h-8 rounded bg-white/20 flex items-center justify-center text-xs font-bold uppercase text-white">
                  {{ file.mimeType.split('/')[1] || 'FILE' }}
                </div>
                <div class="overflow-hidden text-right">
                  <p class="text-xs truncate font-bold">{{ file.name }}</p>
                </div>
              </div>
            }
            <div class="whitespace-pre-wrap leading-7 text-sm sm:text-base font-medium">
              {{ message().text }}
            </div>
          </div>
        </div>
      }

      <!-- ================= AI LAYOUT (Flat & Formatted) ================= -->
      @else {
        <div class="max-w-[92%] sm:max-w-[80%] flex gap-3 sm:gap-4">
          
          <!-- Avatar: App Logo (Shield Check) -->
          <div class="flex-none mt-1">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-sm text-white">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
               <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
             <div class="font-bold text-sm text-slate-900 mb-2">Aman</div>
             
             <!-- GENERATED IMAGES DISPLAY (Professional Grid) -->
             @if (message().generatedImages && message().generatedImages!.length > 0) {
               <div class="mb-4 grid gap-4 w-full max-w-[640px]"
                    [class.grid-cols-1]="message().generatedImages!.length === 1"
                    [class.grid-cols-2]="message().generatedImages!.length > 1"
                    [class.sm:grid-cols-2]="message().generatedImages!.length > 1">
                 
                 @for (img of message().generatedImages; track $index) {
                   <div class="relative group rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 transition-all duration-300 hover:shadow-xl cursor-pointer"
                        (click)="openViewer($index)">
                     
                     <!-- Aspect Ratio Container -->
                     <div class="aspect-square w-full relative">
                        <!-- 'crossorigin' helps with download/canvas issues -->
                        <img [src]="img.url" 
                             [alt]="img.alt || 'Generated Image'" 
                             class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                             loading="lazy">
                        
                        <!-- Gradient Overlay -->
                        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        <!-- Watermark (UI only) -->
                        <div class="absolute bottom-2 right-2 flex items-center gap-1.5 text-white/80 drop-shadow-md pointer-events-none">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                          </svg>
                          <span class="text-[10px] font-semibold tracking-wide">Aman</span>
                        </div>
                     </div>
                     
                     <!-- Actions Overlay -->
                     <div class="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 flex gap-2">
                       
                       <button (click)="downloadImageWithWatermark(img.url, $event)" class="p-2 bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-lg backdrop-blur-sm transition-transform hover:scale-105" title="Download">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                           <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M12 12.75l-3-3m0 0 3-3m-3 3h7.5" transform="rotate(-90 12 12)" />
                         </svg>
                       </button>

                       <button (click)="openViewer($index, $event)" class="p-2 bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-lg backdrop-blur-sm transition-transform hover:scale-105" title="View">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                           <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                         </svg>
                       </button>

                     </div>
                   </div>
                 }
               </div>
             }

             <!-- Formatted Text (Markdown) -->
             @if (message().text) {
                <div 
                  class="text-slate-700 prose max-w-none break-words" 
                  [innerHTML]="renderedText()"
                  (click)="handleContentClick($event)">
                </div>
             }

             <!-- Error -->
             @if (message().isError) {
                <div class="mt-2 text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2">
                  <span>Error connecting.</span>
                </div>
             }
             
             <!-- Actions (Copy Only) -->
             @if (!message().isError && message().text) {
               <div class="mt-2 flex justify-end gap-2 no-print">
                  <!-- Speak Button -->
                  <button (click)="toggleSpeech()"
                          class="p-1.5 rounded-md hover:bg-gray-100 text-slate-400 hover:text-orange-500 transition-colors flex items-center gap-1.5 text-xs"
                          [title]="ttsPlaying() ? 'Stop' : 'Listen'">
                    @if (ttsLoading()) {
                      <svg class="animate-spin h-4 w-4 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    } @else if (ttsPlaying()) {
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
                        <path fill-rule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clip-rule="evenodd" />
                      </svg>
                    } @else {
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.28 8.47a5 5 0 0 1 0 7.06M12 6.75L8.25 9H5.25A1.5 1.5 0 0 0 3.75 10.5v3a1.5 1.5 0 0 0 1.5 1.5h3L12 17.25V6.75Z" />
                      </svg>
                    }
                  </button>
                  <!-- Copy Button -->
                  <button (click)="copyText()" 
                          class="p-1.5 rounded-md hover:bg-gray-100 text-slate-400 hover:text-orange-500 transition-colors flex items-center gap-1.5 text-xs"
                          title="Copy Full Text">
                    @if (copied()) {
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 text-green-500">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    } @else {
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5" />
                      </svg>
                    }
                  </button>
               </div>
             }

             <!-- Image Viewer Modal -->
             @if (viewerOpen() && viewerImage(); as current) {
               <div class="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" (click)="closeViewer()">
                 <div class="relative max-w-5xl w-full" (click)="$event.stopPropagation()">
                   <div class="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
                     <img [src]="current.url" [alt]="current.alt || 'Image'" class="w-full h-auto object-contain max-h-[80vh] bg-black">
                     
                     <!-- Watermark Overlay -->
                     <div class="absolute bottom-4 right-4 flex items-center gap-2 text-white/80 drop-shadow-lg pointer-events-none">
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
                         <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                       </svg>
                       <span class="text-xs font-semibold tracking-wide">Aman</span>
                     </div>
                   </div>

                   <!-- Controls -->
                   <div class="absolute -top-3 right-0 flex gap-2">
                     <button (click)="downloadImageWithWatermark(current.url, $event)" class="px-3 py-2 rounded-lg bg-white/90 hover:bg-white text-slate-900 text-xs font-semibold shadow-lg">Download</button>
                     <button (click)="closeViewer()" class="px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold">Close</button>
                   </div>

                   @if (viewerImages().length > 1) {
                     <button (click)="prevImage($event)" class="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
                         <path fill-rule="evenodd" d="M15.78 4.72a.75.75 0 0 1 0 1.06L10.56 11l5.22 5.22a.75.75 0 0 1-1.06 1.06l-5.75-5.75a.75.75 0 0 1 0-1.06l5.75-5.75a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" />
                       </svg>
                     </button>
                     <button (click)="nextImage($event)" class="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
                         <path fill-rule="evenodd" d="M8.22 19.28a.75.75 0 0 1 0-1.06L13.44 13 8.22 7.78a.75.75 0 0 1 1.06-1.06l5.75 5.75a.75.75 0 0 1 0 1.06l-5.75 5.75a.75.75 0 0 1-1.06 0Z" clip-rule="evenodd" />
                       </svg>
                     </button>
                   }
                 </div>
               </div>
             }
          </div>
        </div>
      }
    </div>
  `
})
export class MessageBubbleComponent implements OnDestroy {
  message = input.required<ChatMessage>();
  isUser = computed(() => this.message().role === 'user');
  renderedText = signal('');
  copied = signal(false);
  viewerOpen = signal(false);
  viewerIndex = signal(0);
  ttsLoading = signal(false);
  ttsPlaying = signal(false);
  ttsError = signal('');
  private audioEl: HTMLAudioElement | null = null;
  private audioUrl: string | null = null;
  viewerImages = computed(() => this.message().generatedImages || []);
  viewerImage = computed(() => {
    const imgs = this.viewerImages();
    const idx = this.viewerIndex();
    return imgs[idx] || null;
  });

  private geminiService = inject(GeminiService);

  constructor() {
    // 1. Configure Marked Renderer for Code Blocks with Modern UI
    const renderer = new marked.Renderer();
    renderer.code = (code, language) => {
      const validLang = language || 'code';
      return `
        <div class="code-wrapper group my-4 rounded-xl overflow-hidden bg-[#1e293b] text-white border border-slate-700/50 relative shadow-md" dir="ltr">
          <div class="flex justify-between items-center bg-[#0f172a]/80 backdrop-blur px-4 py-2 text-xs text-slate-400 select-none border-b border-slate-700/50">
            <div class="flex items-center gap-2">
               <div class="flex gap-1.5">
                 <div class="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
                 <div class="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                 <div class="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
               </div>
               <span class="font-mono font-semibold text-slate-300 ml-2 uppercase tracking-wider">${validLang}</span>
            </div>
            <button class="copy-code-btn flex items-center gap-1.5 hover:text-white hover:bg-white/10 px-2.5 py-1 rounded-md transition-all">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5 pointer-events-none">
                 <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5" />
               </svg>
               <span class="pointer-events-none font-medium">Copy Code</span>
            </button>
          </div>
          <pre class="!m-0 !p-4 !bg-[#1e293b] overflow-x-auto text-sm leading-6 font-mono"><code class="language-${validLang}">${code}</code></pre>
        </div>
      `;
    };
    // Drop raw HTML blocks from markdown (defense-in-depth)
    renderer.html = () => '';
    marked.use({ renderer });

    effect(() => {
      const msg = this.message();
      if (msg.role !== 'user' && msg.text) {
        try {
          const raw = marked.parse(msg.text) as string;
          const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
          this.renderedText.set(clean);
        } catch (e) {
          this.renderedText.set(msg.text);
        }
      }
    });
  }

  handleContentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const btn = target.closest('.copy-code-btn') as HTMLElement;
    
    if (btn) {
      const wrapper = btn.closest('.code-wrapper');
      if (wrapper) {
        const codeElement = wrapper.querySelector('code');
        if (codeElement) {
          const textToCopy = codeElement.innerText;
          navigator.clipboard.writeText(textToCopy).then(() => {
            const span = btn.querySelector('span');
            if (span) {
              const originalText = span.textContent;
              span.textContent = 'Copied!';
              btn.classList.add('text-green-400');
              setTimeout(() => {
                span.textContent = originalText;
                btn.classList.remove('text-green-400');
              }, 2000);
            }
          });
        }
      }
    }
  }

  copyText() {
    const text = this.message().text;
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      });
    }
  }

  async toggleSpeech() {
    if (this.ttsLoading()) return;
    if (this.ttsPlaying()) {
      this.stopSpeech();
      return;
    }

    const text = this.message().text?.trim();
    if (!text) return;

    if (this.audioEl && this.audioUrl) {
      try {
        await this.audioEl.play();
        this.ttsPlaying.set(true);
      } catch {
        this.ttsError.set('Playback failed');
      }
      return;
    }

    this.ttsLoading.set(true);
    this.ttsError.set('');

    try {
      const audio = await this.geminiService.synthesizeSpeech(text, 'Charon');
      this.setAudio(audio.url);
      if (this.audioEl) {
        await this.audioEl.play();
        this.ttsPlaying.set(true);
      }
    } catch {
      this.ttsError.set('Speech failed');
    } finally {
      this.ttsLoading.set(false);
    }
  }

  private setAudio(url: string) {
    if (this.audioUrl && this.audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.audioUrl);
    }
    this.audioUrl = url;
    this.audioEl = new Audio(url);
    this.audioEl.onended = () => {
      this.ttsPlaying.set(false);
    };
    this.audioEl.onerror = () => {
      this.ttsPlaying.set(false);
      this.ttsError.set('Playback failed');
    };
  }

  private stopSpeech() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
    }
    this.ttsPlaying.set(false);
  }

  openViewer(index: number, event?: MouseEvent) {
    event?.stopPropagation();
    this.viewerIndex.set(index);
    this.viewerOpen.set(true);
  }

  closeViewer() {
    this.viewerOpen.set(false);
  }

  nextImage(event?: MouseEvent) {
    event?.stopPropagation();
    const imgs = this.viewerImages();
    if (imgs.length === 0) return;
    this.viewerIndex.update(i => (i + 1) % imgs.length);
  }

  prevImage(event?: MouseEvent) {
    event?.stopPropagation();
    const imgs = this.viewerImages();
    if (imgs.length === 0) return;
    this.viewerIndex.update(i => (i - 1 + imgs.length) % imgs.length);
  }

  async downloadImageWithWatermark(url: string, event?: MouseEvent) {
    event?.stopPropagation();
    try {
      // If it's already a remote URL (e.g., Firebase Storage), just download it directly.
      if (!url.startsWith('data:')) {
        await this.downloadRemote(url);
        return;
      }

      const img = await this.loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const watermark = await this.loadImage(this.getWatermarkSvgDataUrl());
      const padding = Math.max(16, Math.round(canvas.width * 0.02));
      const targetW = Math.max(80, Math.round(canvas.width * 0.18));
      const ratio = (watermark.naturalWidth || watermark.width) / (watermark.naturalHeight || watermark.height);
      const targetH = Math.round(targetW / ratio);

      ctx.globalAlpha = 0.6;
      ctx.drawImage(watermark, canvas.width - targetW - padding, canvas.height - targetH - padding, targetW, targetH);
      ctx.globalAlpha = 1;

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
      if (!blob) throw new Error('Failed to create image blob');

      this.saveBlob(blob, 'png');
    } catch (e) {
      console.warn('Watermark download failed', e);
      this.openInNewTab(url);
    }
  }

  private async downloadRemote(url: string) {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const ext = blob.type.includes('jpeg') ? 'jpg' : (blob.type.includes('webp') ? 'webp' : 'png');
      this.saveBlob(blob, ext);
    } catch (e) {
      console.warn('Remote download failed, opening new tab', e);
      this.openInNewTab(url);
    }
  }

  private saveBlob(blob: Blob, ext: string) {
    const objectUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `aman-image-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(objectUrl);
  }

  private openInNewTab(url: string) {
    window.open(url, '_blank', 'noopener');
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  private getWatermarkSvgDataUrl(): string {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="72" viewBox="0 0 220 72">' +
      '<g transform="translate(0,8) scale(2.2)" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"/>' +
      '</g>' +
      '<text x="70" y="46" fill="#fff" font-size="28" font-family="Arial, sans-serif" font-weight="700">Aman</text>' +
      '</svg>';
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  ngOnDestroy() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = '';
    }
    if (this.audioUrl && this.audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = null;
    }
  }
}
