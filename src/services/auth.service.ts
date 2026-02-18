import { Injectable, signal } from '@angular/core';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User, 
  Auth, 
  updateProfile, 
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBHuDsfjLV-F8LxPzk_BZ30Fc2vl3M_fqg",
  authDomain: "studio-772832865-33905.firebaseapp.com",
  projectId: "studio-772832865-33905",
  storageBucket: "studio-772832865-33905.firebasestorage.app",
  messagingSenderId: "585654670642",
  appId: "1:585654670642:web:fd0b505485b03042e0332b"
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private app: FirebaseApp;
  public auth: Auth;
  public db: Firestore;
  public storage: FirebaseStorage;

  user = signal<User | null>(null);
  isPremium = signal<boolean>(false);
  isLoading = signal<boolean>(true);
  
  constructor() {
    // 1. Initialize Firebase App
    const apps = getApps();
    if (apps.length > 0) {
      this.app = apps[0];
    } else {
      this.app = initializeApp(firebaseConfig);
    }

    // 2. Initialize Auth & Firestore
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.storage = getStorage(this.app);

    // 3. Set up Auth Listener
    onAuthStateChanged(this.auth, async (user) => {
      this.user.set(user);
      if (user) {
        await this.syncUserToDB(user);
      } else {
        this.isPremium.set(false);
      }
      this.isLoading.set(false);
    });
  }

  // --- Email/Password Login ---
  async login(email: string, pass: string) {
    try {
      await signInWithEmailAndPassword(this.auth, email, pass);
    } catch (e: any) {
      console.error('Login failed', e);
      throw e;
    }
  }

  // --- Google Login ---
  async loginWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(this.auth, provider);
      // User sync happens in onAuthStateChanged
    } catch (e: any) {
      console.error('Google Login failed', e);
      throw e;
    }
  }

  // --- Sign Up with Name & Verification ---
  async signup(name: string, email: string, pass: string) {
    try {
      // 1. Create User
      const credential = await createUserWithEmailAndPassword(this.auth, email, pass);
      const user = credential.user;

      // 2. Update Profile with Name
      await updateProfile(user, { displayName: name });

      // 3. Send Verification Email
      await sendEmailVerification(user);

      // 4. Force sync
      await this.syncUserToDB(user, name);

      // Force update local signal
      this.user.set(Object.assign({}, user)); 
    } catch (e: any) {
      console.error('Signup failed', e);
      throw e;
    }
  }

  async logout() {
    await signOut(this.auth);
    this.isPremium.set(false);
  }

  // --- Database Operations ---

  private async syncUserToDB(user: User, displayNameOverride?: string) {
    try {
      const uid = user.uid;
      const docRef = doc(this.db, 'users', uid);
      const docSnap = await getDoc(docRef);
      
      let isPremium = false;
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        isPremium = data['isPremium'] || false;
        // Update last login
        await setDoc(docRef, { 
          lastLogin: new Date().toISOString(),
          email: user.email,
          displayName: displayNameOverride || user.displayName || 'User',
          photoURL: user.photoURL || null
        }, { merge: true });
      } else {
        // Create new record
        await setDoc(docRef, { 
          uid: uid,
          email: user.email,
          displayName: displayNameOverride || user.displayName || 'User',
          photoURL: user.photoURL || null,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          isPremium: false, // Default to false "كمنظر حاليا"
          dailyUsage: 0,
          usageDate: new Date().toDateString()
        });
      }
      
      this.isPremium.set(isPremium);

    } catch (e) {
      console.error('Error syncing user to DB', e);
    }
  }

  // --- Limit Checking ---
  async checkAndIncrementUsage(estimatedTokens: number): Promise<boolean> {
    if (this.isPremium()) return true; // Gold Account has no limits

    const user = this.user();
    if (!user) return false;

    const userRef = doc(this.db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) return false;

    const data = snap.data();
    const today = new Date().toDateString();
    
    // Check if we need to reset
    let currentUsage = data['dailyUsage'] || 0;
    const lastUsageDate = data['usageDate'] || '';

    if (lastUsageDate !== today) {
      currentUsage = 0; // Reset for new day
    }

    const DAILY_LIMIT = 20000; // Roughly 20k chars/tokens per day for standard users

    if (currentUsage + estimatedTokens > DAILY_LIMIT) {
      return false; // Limit exceeded
    }

    // Increment and update date
    await setDoc(userRef, {
      dailyUsage: currentUsage + estimatedTokens,
      usageDate: today
    }, { merge: true });

    return true;
  }

  // --- Preferences (Stored in DB) ---
  async getUserPrefs(uid: string): Promise<{ about?: string; style?: string; focus?: string; profile?: { name?: string; birthdate?: string; location?: string; role?: string; interests?: string; notes?: string } } | null> {
    try {
      const docRef = doc(this.db, 'users', uid);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      const data = snap.data();
      return (data['prefs'] || null) as { about?: string; style?: string; focus?: string } | null;
    } catch (e) {
      console.error('Failed to load user prefs', e);
      return null;
    }
  }

  async saveUserPrefs(uid: string, prefs: { about: string; style: string; focus: string; profile?: { name?: string; birthdate?: string; location?: string; role?: string; interests?: string; notes?: string } }) {
    try {
      const docRef = doc(this.db, 'users', uid);
      await setDoc(docRef, {
        prefs: {
          about: prefs.about || '',
          style: prefs.style || '',
          focus: prefs.focus || '',
          profile: {
            name: prefs.profile?.name || '',
            birthdate: prefs.profile?.birthdate || '',
            location: prefs.profile?.location || '',
            role: prefs.profile?.role || '',
            interests: prefs.profile?.interests || '',
            notes: prefs.profile?.notes || ''
          },
          updatedAt: new Date().toISOString()
        }
      }, { merge: true });
    } catch (e) {
      console.error('Failed to save user prefs', e);
      throw e;
    }
  }

  // --- Storage Helpers ---
  async uploadGeneratedImage(uid: string, dataUrl: string, mimeType?: string): Promise<string | null> {
    try {
      const safeUrl = dataUrl.startsWith('data:')
        ? dataUrl
        : `data:${mimeType || 'image/png'};base64,${dataUrl}`;

      const prepared = await this.prepareImageForUpload(safeUrl);
      if (!prepared) return null;

      const { blob, ext } = prepared;
      const fileRef = ref(this.storage, `users/${uid}/generated/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);

      await uploadBytes(fileRef, blob, { contentType: blob.type });
      return await getDownloadURL(fileRef);
    } catch (e) {
      console.error('Failed to upload generated image', e);
      return null;
    }
  }

  private async prepareImageForUpload(dataUrl: string): Promise<{ blob: Blob; ext: string } | null> {
    try {
      const baseImage = await this.loadImage(dataUrl);
      const watermark = await this.loadImage(this.getWatermarkSvgDataUrl());

      const maxSize = 1536;
      const iw = baseImage.naturalWidth || baseImage.width;
      const ih = baseImage.naturalHeight || baseImage.height;
      const scale = Math.min(1, maxSize / Math.max(iw, ih));
      const w = Math.round(iw * scale);
      const h = Math.round(ih * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(baseImage, 0, 0, w, h);

      // Watermark bottom-right (white, semi-transparent)
      const padding = Math.max(12, Math.round(w * 0.02));
      const targetW = Math.max(90, Math.round(w * 0.18));
      const ratio = (watermark.naturalWidth || watermark.width) / (watermark.naturalHeight || watermark.height);
      const targetH = Math.round(targetW / ratio);

      ctx.globalAlpha = 0.6;
      ctx.drawImage(watermark, w - targetW - padding, h - targetH - padding, targetW, targetH);
      ctx.globalAlpha = 1;

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
      if (!blob) return null;

      return { blob, ext: 'jpg' };
    } catch (e) {
      console.error('Failed to prepare image for upload', e);
      return null;
    }
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
}
