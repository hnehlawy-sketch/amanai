import { Injectable } from '@angular/core';

// ============================================================
// ⚠️ رابط الـ Worker (الخادم الوكيل)
// ============================================================
const WORKER_URL = 'https://aman-ai.h-nehlawy.workers.dev'; 

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  text: string;
  isError?: boolean;
  fileData?: { mimeType: string, data: string, name: string };
  generatedImages?: { url: string, mimeType: string, alt?: string }[]; 
}

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  
  constructor() {}

  startNewChat(lang: 'ar' | 'en' = 'ar') {
    // Reset connection state if needed
  }

  /**
   * Optional: fetch a short-lived Live API token from the worker.
   * The worker should return { token } or { access_token }.
   */
  async getLiveToken(): Promise<string | null> {
    try {
      const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'live_token' })
      });

      if (!response.ok) return null;
      const raw = await response.text();
      if (!raw) return null;

      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        return null;
      }

      const token =
        data?.token ||
        data?.access_token ||
        data?.accessToken ||
        data?.name;

      return typeof token === 'string' ? token : null;
    } catch {
      return null;
    }
  }

  /**
   * Sends chat history to the Custom Worker
   */
  async sendMessage(
    history: ChatMessage[],
    isPremium: boolean,
    signal?: AbortSignal,
    options?: { modelKey?: string; forceSearch?: boolean; customInstruction?: string }
  ): Promise<{ text: string, images?: { url: string, mimeType: string, alt?: string }[] }> { 
    
    const customInstruction = options?.customInstruction?.trim();
    const effectiveHistory = customInstruction
      ? [{ role: 'user', text: customInstruction } as ChatMessage, ...history]
      : history;

    // 1. Prepare Request Body
    const contents = effectiveHistory
      .filter(msg => msg.role !== 'system' && !msg.isError)
      .map(msg => {
        const parts: any[] = [];
        if (msg.text) parts.push({ text: msg.text });
        
        if (msg.fileData && msg.fileData.data) {
          parts.push({
            inlineData: {
              mimeType: msg.fileData.mimeType,
              data: msg.fileData.data
            }
          });
        }
        
        return {
          role: msg.role === 'user' ? 'user' : 'model',
          parts: parts
        };
      });

    // Explicitly using the requested model ID
    const requestBody = {
      action: 'chat',
      contents: contents,
      modelKey: options?.modelKey || 'fast',
      model: options?.modelKey || 'fast',
      userRole: isPremium ? 'pro' : 'standard',
      enableSearch: options?.forceSearch ?? true,
      forceSearch: options?.forceSearch ?? true
    };

    try {
      let fetchSignal = signal;
      let timeoutId: any;

      if (!fetchSignal) {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 60000); 
        fetchSignal = controller.signal;
      }

      const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: fetchSignal
      });
      
      if (timeoutId) clearTimeout(timeoutId);

      // 🛑 FIX: Read as text first to avoid 'Unexpected end of JSON input' crash
      const rawText = await response.text();

      if (!response.ok) {
         let errMsg = `Error ${response.status}`;
         try {
            // Try to parse error details if available
            if (rawText) {
                const errJson = JSON.parse(rawText);
                errMsg = errJson.error || errMsg;
            }
         } catch {
            // If not JSON, append truncated text for debugging
            errMsg += rawText ? `: ${rawText.slice(0, 100)}` : '';
         }
         throw new Error(errMsg);
      }

      if (!rawText) {
        throw new Error('Received empty response from server.');
      }

      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        console.error('Failed to parse JSON:', rawText.slice(0, 200));
      }

      if (!data) {
        const tool = this.extractToolCallFromText(rawText);
        if (tool && (tool.action === 'dalle.text2im' || tool.action === 'generate_image')) {
          const imageResult = await this.generateImageDirectly(tool.prompt);
          return { text: '', images: imageResult };
        }

        const promptOnly = this.extractPromptOnlyFromText(rawText);
        if (promptOnly) {
          const imageResult = await this.generateImageDirectly(promptOnly);
          return { text: '', images: imageResult };
        }

        throw new Error('Invalid server response format.');
      }
      
      if (data.error) {
        throw new Error(data.error);
      }

      let finalText = data.text || '';
      const extracted = this.extractImages(data);
      let finalImages: { url: string, mimeType: string, alt?: string }[] = this.normalizeImages(extracted);

      // If text contains a tool call, try to execute it and strip it from output
      const toolFromText = this.extractToolCallFromText(finalText);
      if (toolFromText && (toolFromText.action === 'dalle.text2im' || toolFromText.action === 'generate_image')) {
        const imageResult = await this.generateImageDirectly(toolFromText.prompt);
        if (imageResult && imageResult.length > 0) {
          finalImages = [...finalImages, ...imageResult];
        }
        finalText = this.stripToolCallText(finalText);
      }

      // If text contains only a prompt block, generate image too
      if (finalImages.length === 0) {
        const promptOnly = this.extractPromptOnlyFromText(finalText);
        if (promptOnly) {
          const imageResult = await this.generateImageDirectly(promptOnly);
          if (imageResult && imageResult.length > 0) {
            finalImages = [...finalImages, ...imageResult];
          }
          finalText = this.stripPromptBlock(finalText);
        }
      }

      // =================================================================
      // 🕵️‍♂️ AGENT JSON CLEANUP
      // =================================================================
      try {
        const jsonBlockRegex = /```json\s*(\{[\s\S]*?"action"[\s\S]*?\})\s*```|(\{[\s\S]*?"action"\s*:\s*"[^"]+"[\s\S]*?\})/g;
        
        let match;
        while ((match = jsonBlockRegex.exec(finalText)) !== null) {
          const jsonStr = match[1] || match[2];
          
          try {
            const cleanJson = jsonStr.replace(/[\n\r]/g, ' ').trim();
            const agentData = JSON.parse(cleanJson);

            if (agentData.thought) {
              finalText = finalText.replace(match[0], agentData.thought + '\n\n');
            } else {
              finalText = finalText.replace(match[0], '');
            }

            if (
              (agentData.action === 'dalle.text2im' || agentData.action === 'generate_image') && 
              agentData.action_input && 
              agentData.action_input.prompt
            ) {
              const imagePrompt = agentData.action_input.prompt;
              const imageResult = await this.generateImageDirectly(imagePrompt);
              if (imageResult && imageResult.length > 0) {
                finalImages = [...finalImages, ...imageResult];
              }
            }
          } catch (jsonErr) {
            console.warn('Failed to parse Agent JSON', jsonErr);

            // Fallback for malformed JSON (e.g. unescaped quotes)
            const actionMatch = jsonStr.match(/"action"\s*:\s*"([^"]+)"/);
            const promptMatch = jsonStr.match(/"prompt"\s*:\s*"([^"]+)"/);
            const action = actionMatch?.[1];
            const prompt = promptMatch?.[1];

            if (action && prompt && (action === 'dalle.text2im' || action === 'generate_image')) {
              const imageResult = await this.generateImageDirectly(prompt);
              if (imageResult && imageResult.length > 0) {
                finalImages = [...finalImages, ...imageResult];
              }
              // Strip the malformed tool block from text
              finalText = finalText.replace(match[0], '').trim();
            }
          }
        }
      } catch (e) {
        console.warn('Agent Parsing Loop Failed', e);
      }

      // =================================================================
      // 🛡️ FALLBACK: Extract Markdown Images
      // =================================================================
      const markdownImageRegex = /!\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g;
      let imgMatch;
      let textWithoutImages = finalText;

      while ((imgMatch = markdownImageRegex.exec(finalText)) !== null) {
        const alt = imgMatch[1];
        const url = imgMatch[2];
        const exists = finalImages.some(img => img.url === url);
        if (!exists) {
          finalImages.push({ url, mimeType: 'image/png', alt });
        }
        textWithoutImages = textWithoutImages.replace(imgMatch[0], ''); 
      }
      
      return { 
        text: textWithoutImages.trim() || finalText.trim(), 
        images: finalImages 
      };

    } catch (error: any) {
      console.error('Gemini Service Error:', error);
      if (error.name === 'AbortError') throw new Error('تم إيقاف التوليد.');
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') throw new Error('فشل الاتصال بالخادم. تأكد من الإنترنت.');
      throw error;
    }
  }

  /**
   * Text-to-Speech via worker. Returns an audio URL (WAV) for playback.
   */
  async synthesizeSpeech(text: string, voice: string = 'Charon'): Promise<{ url: string; mimeType: string }> {
    const payload = {
      action: 'tts',
      text,
      voice
    };

    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const raw = await response.text();
    if (!response.ok) {
      let errMsg = `Error ${response.status}`;
      try {
        const errJson = raw ? JSON.parse(raw) : null;
        if (errJson?.error) errMsg = errJson.error;
      } catch {}
      throw new Error(errMsg);
    }

    if (!raw) throw new Error('Empty TTS response');

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('Invalid TTS response');
    }

    if (data?.error) throw new Error(data.error);

    const audioUrl = data?.audioUrl || data?.url;
    if (audioUrl && typeof audioUrl === 'string') {
      return { url: audioUrl, mimeType: data?.mimeType || 'audio/wav' };
    }

    const audioData =
      data?.audio?.data ||
      data?.audioData ||
      data?.data ||
      data?.audio;

    const mimeType =
      data?.audio?.mimeType ||
      data?.mimeType ||
      data?.type ||
      'audio/pcm;rate=24000';

    if (!audioData || typeof audioData !== 'string') {
      throw new Error('No audio data returned');
    }

    const cleanBase64 = this.stripDataUrlPrefix(audioData);
    if (this.isPcmMime(mimeType)) {
      const wavBlob = this.pcmBase64ToWavBlob(cleanBase64, this.extractSampleRate(mimeType) || 24000, 1);
      const url = URL.createObjectURL(wavBlob);
      return { url, mimeType: 'audio/wav' };
    }

    const blob = this.base64ToBlob(cleanBase64, mimeType);
    const url = URL.createObjectURL(blob);
    return { url, mimeType };
  }

  private stripDataUrlPrefix(input: string): string {
    if (!input) return '';
    const idx = input.indexOf('base64,');
    return idx >= 0 ? input.slice(idx + 7) : input.trim();
  }

  private extractSampleRate(mimeType: string): number | null {
    const match = mimeType.match(/rate=(\d+)/);
    if (match && match[1]) return parseInt(match[1], 10);
    return null;
  }

  private isPcmMime(mimeType?: string): boolean {
    if (!mimeType) return false;
    const m = mimeType.toLowerCase();
    return m.includes('audio/pcm') || m.includes('audio/l16') || m.includes('codec=pcm');
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  private pcmBase64ToWavBlob(base64Pcm: string, sampleRate: number, channels: number): Blob {
    const pcmBytes = this.base64ToUint8(base64Pcm);
    const bytesPerSample = 2;
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;

    const buffer = new ArrayBuffer(44 + pcmBytes.length);
    const view = new DataView(buffer);

    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmBytes.length, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, pcmBytes.length, true);

    new Uint8Array(buffer, 44).set(pcmBytes);
    return new Blob([buffer], { type: 'audio/wav' });
  }

  private base64ToUint8(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private writeString(view: DataView, offset: number, value: string) {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  }

  private async generateImageDirectly(prompt: string): Promise<{ url: string, mimeType: string, alt?: string }[]> {
    try {
      const requestBody = {
        action: 'chat',
        contents: [{ role: 'user', parts: [{ text: `draw: ${prompt}` }] }],
        model: 'gemini-3-flash-preview' 
      };

      const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const text = await response.text();
      if (!response.ok || !text) return [];

      try {
        const data = JSON.parse(text);
        const extracted = this.extractImages(data);
        return this.normalizeImages(extracted);
      } catch {
        return [];
      }
    } catch (e) {
      console.error('Secondary image generation failed', e);
      return [];
    }
  }

  private extractImages(data: any): any[] {
    if (!data) return [];
    const candidates: any[] = [
      data.images,
      data.image,
      data.imageUrl,
      data.image_url,
      data.output?.images,
      data.output?.image,
      data.result?.images,
      data.result?.image,
      data.response?.images,
      data.response?.image,
      data.data?.images,
      data.data?.image
    ];

    const parts = data.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      const inline = parts
        .filter((p: any) => p?.inlineData?.data)
        .map((p: any) => p.inlineData);
      if (inline.length > 0) candidates.push(inline);
    }

    return candidates.flatMap((v) => (v ? (Array.isArray(v) ? v : [v]) : []));
  }

  private normalizeImages(raw: any): { url: string, mimeType: string, alt?: string }[] {
    const items = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    const out: { url: string, mimeType: string, alt?: string }[] = [];

    for (const item of items) {
      if (!item) continue;

      // String URL or base64
      if (typeof item === 'string') {
        const url = this.normalizeUrlOrData(item, undefined);
        if (url) out.push({ url, mimeType: this.inferMime(url), alt: undefined });
        continue;
      }

      // Common url fields
      const urlField = item.url || item.imageUrl || item.image_url;
      if (urlField) {
        const url = this.normalizeUrlOrData(urlField, item.mimeType || item.mime_type);
        if (url) out.push({ url, mimeType: this.inferMime(url, item.mimeType || item.mime_type), alt: item.alt });
        continue;
      }

      // Inline data / base64 fields
      const dataField =
        item.data ||
        item.base64 ||
        item.b64 ||
        item.bytes ||
        item.image ||
        item.inlineData?.data;

      if (dataField) {
        const mime = item.mimeType || item.mime_type || item.inlineData?.mimeType;
        const url = this.toDataUrl(String(dataField), mime);
        out.push({ url, mimeType: mime || 'image/png', alt: item.alt });
      }
    }

    return out;
  }

  private normalizeUrlOrData(value: string, mimeType?: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:')) return trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (this.isProbablyBase64(trimmed)) return this.toDataUrl(trimmed, mimeType);
    return null;
  }

  private toDataUrl(data: string, mimeType?: string): string {
    const clean = data.replace(/^data:.*?;base64,/, '').trim();
    const mime = mimeType || 'image/png';
    return `data:${mime};base64,${clean}`;
  }

  private isProbablyBase64(value: string): boolean {
    if (value.length < 40) return false;
    return /^[A-Za-z0-9+/=\s]+$/.test(value);
  }

  private inferMime(url: string, fallback?: string): string {
    if (fallback) return fallback;
    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);/);
      if (match && match[1]) return match[1];
    }
    if (url.endsWith('.jpg') || url.endsWith('.jpeg')) return 'image/jpeg';
    if (url.endsWith('.webp')) return 'image/webp';
    if (url.endsWith('.gif')) return 'image/gif';
    return 'image/png';
  }

  private extractToolCallFromText(text: string): { action: string; prompt: string } | null {
    const actionMatch = text.match(/"?action"?\s*:\s*"([^"]+)"/);
    const promptMatch = text.match(/"prompt"\s*:\s*"([^"]+)"/);
    if (!actionMatch || !promptMatch) return null;
    return { action: actionMatch[1], prompt: promptMatch[1] };
  }

  private stripToolCallText(text: string): string {
    // Remove JSON-ish tool call blobs or single-line tool call text
    const blobRegex = /\{?\s*"?action"?\s*:\s*"(dalle\.text2im|generate_image)"[\s\S]*?\}?/g;
    let cleaned = text.replace(blobRegex, '').trim();

    // Also drop any line that still contains tool call markers
    const lines = cleaned.split('\n');
    const filtered = lines.filter(l => {
      const line = l.trim();
      if (!line) return true;
      const hasAction = /"?action"?\s*:\s*"(dalle\.text2im|generate_image)"/.test(line);
      const hasActionInput = /"action_input"|\"prompt\"\s*:/.test(line);
      return !(hasAction || hasActionInput);
    });

    return filtered.join('\n').trim();
  }

  private extractPromptOnlyFromText(text: string): string | null {
    // Try JSON code fence first
    const fenced = text.match(/```json\s*({[\s\S]*?})\s*```/i);
    if (fenced && fenced[1]) {
      try {
        const parsed = JSON.parse(fenced[1]);
        if (parsed?.prompt) return String(parsed.prompt);
      } catch {
        // fall through
      }
    }

    // Fallback: inline JSON-like prompt
    const promptMatch = text.match(/"prompt"\s*:\s*"([^"]+)"/);
    if (promptMatch && promptMatch[1]) return promptMatch[1];
    return null;
  }

  private stripPromptBlock(text: string): string {
    let cleaned = text.replace(/```json[\s\S]*?```/gi, '').trim();
    cleaned = cleaned.replace(/\{?\s*"prompt"\s*:\s*"[^"]+"\s*\}?/g, '').trim();
    return cleaned;
  }
}
