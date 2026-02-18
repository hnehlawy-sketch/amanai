import { Component, ElementRef, ViewChild, inject, signal, effect, OnInit, computed, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService, ChatMessage } from './services/gemini.service';
import { AuthService } from './services/auth.service';
import { MessageBubbleComponent } from './components/message-bubble.component';
import { doc, setDoc, collection, writeBatch, getDocs } from 'firebase/firestore';

declare var window: any;

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: number;
  updatedAt?: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageBubbleComponent],
  templateUrl: './app.component.html',
  host: {
    'class': 'h-full block'
  }
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  private geminiService = inject(GeminiService);
  public authService = inject(AuthService); 
  
  // -- PWA Install State --
  deferredPrompt: any = null;
  showInstallPrompt = signal(false);

  // -- Auth UI State --
  showAuthModal = signal(false); 
  authMode = signal<'login' | 'signup'>('login');
  authEmail = signal('');
  authPass = signal('');
  authName = signal('');
  authLoading = signal(false);
  authError = signal('');
  authSuccess = signal('');

  // -- App Settings --
  currentLang = signal<'ar'|'en'>('ar');
  theme = signal<'light'|'dark'>('light');
  modelKey = signal<'core'|'fast'|'pro'>('fast');
  responseStyle = signal<'smooth'|'instant'>('smooth');
  showModelMenu = signal(false);
  showSettingsModal = signal(false);
  showProfileModal = signal(false);

  // -- Personalization --
  customAbout = signal('');
  customStyle = signal('');
  customFocus = signal('');
  profileName = signal('');
  profileBirthdate = signal('');
  profileLocation = signal('');
  profileRole = signal('');
  profileInterests = signal('');
  profileNotes = signal('');
  prefsStatus = signal<'idle'|'saving'|'saved'>('idle');
  private prefsSaveTimer: any = null;
  private lastPrefsUid: string | null = null;
  
  // -- Translations --
  translations: any = {
    ar: {
      appName: 'Aman AI',
      newChat: 'محادثة جديدة',
      recent: 'الأرشيف',
      placeholder: 'اكتب رسالة...',
      menu: 'القائمة',
      greeting: 'أهلاً بك',
      greetingSub: 'أنا أمان، مساعدك الشخصي.',
      actionFile: '📄 تحليل ملف',
      disclaimer: 'الذكاء الاصطناعي مو نبي، ممكن يغلط.. دير بالك.',
      upload: 'إرفاق',
      processing: 'جارِ الكتابة...',
      error: 'حدث خطأ في الاتصال.',
      deleteConfirm: 'هل أنت متأكد من الحذف؟',     
      listening: '\u0627\u0633\u062a\u0645\u0627\u0639...',
      liveTitle: '\u0645\u062d\u0627\u062f\u062b\u0629 \u0644\u0627\u064a\u0641',
      liveSubtitle: '\u0627\u062d\u0643\u064a \u0648\u0627\u0646\u0627 \u0628\u0631\u062f \u0641\u0648\u0631\u0627',
      liveConnecting: '\u062c\u0627\u0631 \u0627\u0644\u0627\u062a\u0635\u0627\u0644...',
      liveListening: '\u0639\u0645 \u0628\u0633\u0645\u0639',
      liveSpeaking: '\u0639\u0645 \u0628\u062d\u0643\u064a',
      liveMuted: '\u0635\u0648\u062a\u0643 \u0645\u0643\u062a\u0648\u0645',
      liveIdle: '\u062c\u0627\u0647\u0632',
      liveClose: '\u0625\u0646\u0647\u0627\u0621',
      liveMute: '\u0643\u062a\u0645',
      liveUnmute: '\u062a\u0634\u063a\u064a\u0644',
      export: 'تصدير النص',
      premiumSoon: 'النسخة المتقدمة (قريباً)',
      logout: 'تسجيل خروج',
      loginTitle: 'تسجيل الدخول للمتابعة',
      signupTitle: 'إنشاء حساب جديد',
      email: 'البريد الإلكتروني',
      password: 'كلمة السر',
      name: 'الاسم الكامل',
      loginBtn: 'دخول',
      signupBtn: 'إنشاء حساب',
      googleBtn: 'المتابعة باستخدام Google',
      noAccount: 'ليس لديك حساب؟',
      hasAccount: 'لديك حساب بالفعل؟',
      createOne: 'أنشئ حساباً',
      signInHere: 'سجل دخولك',
      verifyEmail: 'يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب.',
      authErr: 'بيانات الدخول غير صحيحة أو حدث خطأ.',
      settings: 'الإعدادات',
      language: 'اللغة',
      darkMode: 'الوضع الليلي',
      engine: 'محرك أمان',
      engineCore: 'Aman Core',
      engineFast: 'Aman Fast',
      enginePro: 'Aman Pro',
      responseStyle: 'أسلوب الرد',
      responseSmooth: 'متدرّج',
      responseInstant: 'فوري',
      personalization: 'تخصيص أمان',
      profile: 'الملف الشخصي',
      profileHint: 'هاي البيانات خاصة لتخصيص الردود بشكل دائم.',
      profileOpen: 'فتح الملف',
      backToSettings: 'رجوع للإعدادات',
      fullName: 'الاسم الكامل',
      fullNameHint: 'مثال: أحمد خليل',
      birthDate: 'تاريخ الميلاد',
      location: 'المدينة / البلد',
      locationHint: 'مثال: دمشق، سوريا',
      role: 'المهنة / الدراسة',
      roleHint: 'مثال: مهندس برمجيات',
      interests: 'الاهتمامات',
      interestsHint: 'مثال: ريادة أعمال، تقنية، تصميم',
      notes: 'ملاحظات إضافية',
      notesHint: 'أي تفاصيل بتحبها تكون معروفة دائماً.',
      aboutYou: 'نبذة عنك',
      aboutYouHint: 'مثال: أنا طالب هندسة وبدي شرح بسيط.',
      responsePref: 'أسلوب الرد',
      responsePrefHint: 'مثال: مختصر، مباشر، مع نقاط.',
      focusPref: 'شو بدك يركز عليه',
      focusPrefHint: 'مثال: أسعار محدثة، خطوات عملية.',
      saved: 'تم الحفظ',
      saving: 'جارٍ الحفظ...',
      stop: 'توقف',
      mustLogin: 'يرجى تسجيل الدخول لإرسال الرسائل وحفظ المحادثات.',
      limitReached: 'عذراً، لقد تجاوزت الحد اليومي للرسائل. اشترك في النسخة الذهبية للمتابعة.',
      installApp: 'تثبيت التطبيق',
      installDesc: 'قم بتثبيت أمان للوصول السريع وتجربة شاشة كاملة.',
      install: 'تثبيت',
      later: 'لاحقاً'
    },
    en: {
      appName: 'Aman AI',
      newChat: 'New Chat',
      recent: 'History',
      placeholder: 'Type a message...',
      menu: 'Menu',
      greeting: 'Welcome',
      greetingSub: 'I am Aman, your personal assistant.',
      actionFile: '📄 Analyze File',
      disclaimer: 'AI is not a prophet, it can make mistakes. Watch out.',
      upload: 'Upload',
      processing: 'Thinking...',
      error: 'Connection failed.',
      deleteConfirm: 'Delete chat?',
      listening: 'Listening...',
      liveTitle: 'Live Voice',
      liveSubtitle: 'Speak and I will respond instantly.',
      liveConnecting: 'Connecting...',
      liveListening: 'Listening',
      liveSpeaking: 'Speaking',
      liveMuted: 'Muted',
      liveIdle: 'Ready',
      liveClose: 'End',
      liveMute: 'Mute',
      liveUnmute: 'Unmute',
      export: 'Export',
      premiumSoon: 'Pro Mode (Soon)',
      logout: 'Logout',
      loginTitle: 'Login to Continue',
      signupTitle: 'Create Account',
      email: 'Email Address',
      password: 'Password',
      name: 'Full Name',
      loginBtn: 'Login',
      signupBtn: 'Sign Up',
      googleBtn: 'Continue with Google',
      noAccount: 'No account?',
      hasAccount: 'Have an account?',
      createOne: 'Create one',
      signInHere: 'Sign in',
      verifyEmail: 'Please verify your email address.',
      authErr: 'Invalid credentials or error occurred.',
      settings: 'Settings',
      language: 'Language',
      darkMode: 'Dark Mode',
      engine: 'Aman Engine',
      engineCore: 'Aman Core',
      engineFast: 'Aman Fast',
      enginePro: 'Aman Pro',
      responseStyle: 'Response Style',
      responseSmooth: 'Smooth',
      responseInstant: 'Instant',
      personalization: 'Personalization',
      profile: 'Profile',
      profileHint: 'Private info used to personalize responses.',
      profileOpen: 'Open profile',
      backToSettings: 'Back to settings',
      fullName: 'Full name',
      fullNameHint: 'Example: Ahmad Khalil',
      birthDate: 'Birth date',
      location: 'City / Country',
      locationHint: 'Example: Damascus, Syria',
      role: 'Role / Study',
      roleHint: 'Example: Software Engineer',
      interests: 'Interests',
      interestsHint: 'Example: Startups, tech, design',
      notes: 'Extra notes',
      notesHint: 'Anything you want remembered.',
      aboutYou: 'About you',
      aboutYouHint: 'Example: I am a CS student, keep it simple.',
      responsePref: 'Response style',
      responsePrefHint: 'Example: Short, direct, bullet points.',
      focusPref: 'What to focus on',
      focusPrefHint: 'Example: Fresh prices, practical steps.',
      saved: 'Saved',
      saving: 'Saving...',
      stop: 'Stop',
      mustLogin: 'Please login to send messages and save chats.',
      limitReached: 'Sorry, you have reached your daily message limit. Upgrade to Premium to continue.',
      installApp: 'Install App',
      installDesc: 'Install Aman for quick access and full-screen experience.',
      install: 'Install',
      later: 'Later'
    }
  };

  t = computed(() => this.translations[this.currentLang()]);
  currentModelLabel = computed(() => {
    const key = this.modelKey();
    const labels: Record<string, string> = {
      core: this.t().engineCore,
      fast: this.t().engineFast,
      pro: this.t().enginePro
    };
    return labels[key] || this.t().engineCore;
  });
  liveStatusLabel = computed(() => {
    if (!this.voiceMode()) return '';
    const err = this.liveError();
    if (err) return err;
    if (!this.liveReady()) return this.t().liveConnecting;
    if (this.voiceSpeaking()) return this.t().liveSpeaking;
    if (this.liveMuted()) return this.t().liveMuted;
    if (this.liveListening()) return this.t().liveListening;
    return this.t().liveIdle;
  });

  // -- Core State --
  currentSessionId = signal<string>('');
  sessions = signal<ChatSession[]>([]);
  messages = signal<ChatMessage[]>([]);
  abortController: AbortController | null = null;
  
  // -- UI State --
  inputMessage = signal('');
  isLoading = signal(false);
  isSidebarOpen = signal(false);
  isListening = signal(false);
  voiceMode = signal(false);
  voiceSpeaking = signal(false);
  liveMuted = signal(false);
  liveError = signal('');
  liveUserPreview = signal('');
  liveModelPreview = signal('');
  liveListening = signal(false);
  showUserMenu = signal(false);

  composerHeight = signal(0);
  private composerResize?: ResizeObserver;
  private readonly LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
  private readonly LIVE_WS_V1BETA =
    'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
  private readonly LIVE_WS_V1ALPHA_CONSTRAINED =
    'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';
  private readonly LIVE_INPUT_RATE = 16000;
  private readonly LIVE_OUTPUT_RATE = 24000;

  private liveWs: WebSocket | null = null;
  liveReady = signal(false);
  private liveClosing = false;
  private liveUserMsgIndex: number | null = null;
  private liveModelMsgIndex: number | null = null;
  private liveHasOutputTranscription = false;

  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micProcessor: ScriptProcessorNode | null = null;
  private micContext: AudioContext | null = null;
  private micMuteGain: GainNode | null = null;

  private outputContext: AudioContext | null = null;
  private outputNextTime = 0;
  private outputSources: AudioBufferSourceNode[] = [];
  
  selectedFile = signal<{name: string, data: string, mimeType: string} | null>(null);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  @ViewChild('fileInput') private fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('textarea') private textarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('composer') private composer!: ElementRef<HTMLElement>;

  constructor() {
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallPrompt.set(true);
    });

    effect(() => {
      const allSessions = this.sessions();
      if (allSessions.length > 0) {
        this.persistSessions(allSessions);
      }
    });

    effect(() => {
      const msgs = this.messages();
      const id = this.currentSessionId();
      if (id && msgs.length >= 0) {
        this.updateSessionMessages(id, msgs);
      }
    });

    effect(() => {
      const user = this.authService.user();
      if (user?.uid) {
        if (this.lastPrefsUid !== user.uid) {
          this.lastPrefsUid = user.uid;
          this.loadRemoteSessions(user.uid);
          this.loadPreferences(user.uid);
        }
      } else if (this.lastPrefsUid) {
        this.lastPrefsUid = null;
        this.resetPreferences();
      }
    });

    const savedTheme = localStorage.getItem('aman_theme') as 'light' | 'dark';
    if (savedTheme) this.theme.set(savedTheme);

    const savedModel = localStorage.getItem('aman_model') as 'core' | 'fast' | 'pro' | null;
    if (savedModel) this.modelKey.set(savedModel);

    const savedStyle = localStorage.getItem('aman_response_style') as 'smooth' | 'instant' | null;
    if (savedStyle) this.responseStyle.set(savedStyle);

    effect(() => {
      localStorage.setItem('aman_model', this.modelKey());
    });

    effect(() => {
      localStorage.setItem('aman_response_style', this.responseStyle());
    });
  }

  ngOnInit() {
    this.loadSessions();
    if (this.sessions().length === 0) {
      this.createNewChat(false);
    } else {
      this.loadSession(this.sessions()[0].id, false);
    }
  }

  ngAfterViewInit() {
    const composerEl = this.composer?.nativeElement;
    if (!composerEl) return;

    const update = () => {
      this.composerHeight.set(composerEl.getBoundingClientRect().height);
    };

    update();
    this.composerResize = new ResizeObserver(update);
    this.composerResize.observe(composerEl);
  }

  ngOnDestroy() {
    this.composerResize?.disconnect();
    this.stopVoiceMode();
  }

  async installPwa() {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.showInstallPrompt.set(false);
  }

  dismissInstall() {
    this.showInstallPrompt.set(false);
  }

  toggleLang() {
    this.currentLang.update(l => l === 'ar' ? 'en' : 'ar');
  }

  toggleTheme() {
    this.setTheme(this.theme() === 'light' ? 'dark' : 'light');
  }

  setTheme(value: 'light' | 'dark') {
    this.theme.set(value);
    localStorage.setItem('aman_theme', value);
  }

  setModel(key: 'core' | 'fast' | 'pro') {
    this.modelKey.set(key);
    this.showModelMenu.set(false);
  }

  setResponseStyle(style: 'smooth' | 'instant') {
    this.responseStyle.set(style);
  }

  updateCustomAbout(value: string) {
    this.customAbout.set(value);
    this.schedulePrefsSave();
  }

  updateCustomStyle(value: string) {
    this.customStyle.set(value);
    this.schedulePrefsSave();
  }

  updateCustomFocus(value: string) {
    this.customFocus.set(value);
    this.schedulePrefsSave();
  }

  updateProfileName(value: string) {
    this.profileName.set(value);
    this.schedulePrefsSave();
  }

  updateProfileBirthdate(value: string) {
    this.profileBirthdate.set(value);
    this.schedulePrefsSave();
  }

  updateProfileLocation(value: string) {
    this.profileLocation.set(value);
    this.schedulePrefsSave();
  }

  updateProfileRole(value: string) {
    this.profileRole.set(value);
    this.schedulePrefsSave();
  }

  updateProfileInterests(value: string) {
    this.profileInterests.set(value);
    this.schedulePrefsSave();
  }

  updateProfileNotes(value: string) {
    this.profileNotes.set(value);
    this.schedulePrefsSave();
  }

  private schedulePrefsSave() {
    if (this.prefsSaveTimer) clearTimeout(this.prefsSaveTimer);
    const user = this.authService.user();
    if (!user) {
      this.prefsStatus.set('idle');
      return;
    }

    this.prefsStatus.set('saving');

    const payload = {
      about: this.customAbout(),
      style: this.customStyle(),
      focus: this.customFocus(),
      profile: {
        name: this.profileName(),
        birthdate: this.profileBirthdate(),
        location: this.profileLocation(),
        role: this.profileRole(),
        interests: this.profileInterests(),
        notes: this.profileNotes()
      }
    };

    const uid = user.uid;
    this.prefsSaveTimer = setTimeout(async () => {
      if (this.authService.user()?.uid !== uid) return;
      try {
        await this.authService.saveUserPrefs(uid, payload);
        this.prefsStatus.set('saved');
      } catch (e) {
        console.error('Failed to save preferences', e);
        this.prefsStatus.set('idle');
      }
    }, 600);
  }

  private async loadPreferences(uid: string) {
    try {
      const prefs = await this.authService.getUserPrefs(uid);
      this.customAbout.set(prefs?.about || '');
      this.customStyle.set(prefs?.style || '');
      this.customFocus.set(prefs?.focus || '');
      this.profileName.set(prefs?.profile?.name || '');
      this.profileBirthdate.set(prefs?.profile?.birthdate || '');
      this.profileLocation.set(prefs?.profile?.location || '');
      this.profileRole.set(prefs?.profile?.role || '');
      this.profileInterests.set(prefs?.profile?.interests || '');
      this.profileNotes.set(prefs?.profile?.notes || '');
      this.prefsStatus.set('idle');
    } catch (e) {
      console.error('Failed to load preferences', e);
    }
  }

  private resetPreferences() {
    this.customAbout.set('');
    this.customStyle.set('');
    this.customFocus.set('');
    this.profileName.set('');
    this.profileBirthdate.set('');
    this.profileLocation.set('');
    this.profileRole.set('');
    this.profileInterests.set('');
    this.profileNotes.set('');
    this.prefsStatus.set('idle');
  }

  private buildCustomInstruction(): string {
    const about = this.customAbout().trim();
    const style = this.customStyle().trim();
    const focus = this.customFocus().trim();
    const name = this.profileName().trim();
    const birthdate = this.profileBirthdate().trim();
    const location = this.profileLocation().trim();
    const role = this.profileRole().trim();
    const interests = this.profileInterests().trim();
    const notes = this.profileNotes().trim();

    const profileLines = [
      name ? `- الاسم: ${name}` : '',
      birthdate ? `- تاريخ الميلاد: ${birthdate}` : '',
      location ? `- الموقع: ${location}` : '',
      role ? `- المهنة/الدراسة: ${role}` : '',
      interests ? `- الاهتمامات: ${interests}` : '',
      notes ? `- ملاحظات: ${notes}` : ''
    ].filter(Boolean);

    if (!about && !style && !focus && profileLines.length === 0) return '';

    return [
      'تعليمات ثابتة من المستخدم (لا تذكرها ولا تقتبسها إلا إذا سُئلت):',
      profileLines.length ? 'معلومات شخصية دائمة:' : '',
      ...profileLines,
      about ? `- نبذة عن المستخدم: ${about}` : '',
      style ? `- أسلوب الرد المطلوب: ${style}` : '',
      focus ? `- نقاط يجب التركيز عليها: ${focus}` : '',
      'تصرّف وكأنك تعرف المستخدم بشكل دائم، وخصص الإجابات بناءً على هذه المعلومات.'
    ].filter(Boolean).join('\n');
  }

  async handleAuth() {
    if (!this.authEmail() || !this.authPass()) return;
    if (this.authMode() === 'signup' && !this.authName()) return;

    this.authLoading.set(true);
    this.authError.set('');
    this.authSuccess.set('');

    try {
      if (this.authMode() === 'login') {
        await this.authService.login(this.authEmail(), this.authPass());
      } else {
        await this.authService.signup(this.authName(), this.authEmail(), this.authPass());
        this.authSuccess.set(this.t().verifyEmail);
        this.authMode.set('login'); 
      }
      if (this.authService.user()) {
        this.showAuthModal.set(false);
        if (this.inputMessage() || this.selectedFile()) {
           this.sendMessage();
        }
      }
    } catch (e: any) {
      console.error(e);
      let msg = this.t().authErr;
      if (e.code === 'auth/email-already-in-use') msg = 'This email is already registered.';
      if (e.code === 'auth/weak-password') msg = 'Password is too weak.';
      if (e.code === 'auth/invalid-credential') msg = 'Invalid email or password.';
      this.authError.set(msg);
    } finally {
      this.authLoading.set(false);
    }
  }

  async handleGoogleAuth() {
    this.authLoading.set(true);
    this.authError.set('');
    
    try {
      await this.authService.loginWithGoogle();
      if (this.authService.user()) {
        this.showAuthModal.set(false);
        if (this.inputMessage() || this.selectedFile()) {
          this.sendMessage();
        }
      }
    } catch (e) {
      this.authError.set(this.t().authErr);
    } finally {
      this.authLoading.set(false);
    }
  }

  toggleAuthMode() {
    this.authMode.update(m => m === 'login' ? 'signup' : 'login');
    this.authError.set('');
    this.authSuccess.set('');
  }

  async logout() {
    await this.authService.logout();
    this.showUserMenu.set(false);
  }

  getUserInitials(name: string): string {
    if (!name) return 'A';
    return name.slice(0, 2).toUpperCase();
  }

  loadSessions() {
    const saved = localStorage.getItem('aman_sessions_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        parsed.sort((a: ChatSession, b: ChatSession) => b.timestamp - a.timestamp);
        this.sessions.set(parsed);
      } catch (e) {
        console.error('Failed to load sessions', e);
        this.sessions.set([]);
      }
    }
  }

  async loadRemoteSessions(uid: string) {
    try {
      const chatsRef = collection(this.authService.db, 'users', uid, 'chats');
      const snapshot = await getDocs(chatsRef);
      const remoteSessions: ChatSession[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data() as ChatSession;
        if (data.id && data.messages) {
          remoteSessions.push(data);
        }
      });

      if (remoteSessions.length > 0) {
        this.sessions.update(current => {
          const combined = [...current];
          remoteSessions.forEach(r => {
             const idx = combined.findIndex(c => c.id === r.id);
             if (idx >= 0) {
               const local = combined[idx];
               const localUpdated = this.getSessionUpdatedAt(local);
               const remoteUpdated = this.getSessionUpdatedAt(r);
               const localCount = local.messages?.length || 0;
               const remoteCount = r.messages?.length || 0;
               const localHasImages = this.sessionHasImages(local);
               const remoteHasImages = this.sessionHasImages(r);
               
               // Prefer the newer or richer session; never overwrite newer local data
               if (
                 remoteUpdated > localUpdated &&
                 remoteCount >= localCount &&
                 (!localHasImages || remoteHasImages)
               ) {
                 combined[idx] = r;
               }
             } else {
               combined.push(r);
             }
          });
          return combined.sort((a,b) => b.timestamp - a.timestamp);
        });
        
        if (this.currentSessionId()) {
          const updated = this.sessions().find(s => s.id === this.currentSessionId());
          if (updated) {
            this.messages.set(updated.messages);
          }
        }
      }
    } catch (e) {
      console.error('Error loading remote chats', e);
    }
  }

  createNewChat(closeSidebar = true) {
    const newId = crypto.randomUUID();
    const newSession: ChatSession = {
      id: newId,
      title: this.currentLang() === 'ar' ? 'محادثة جديدة' : 'New Chat',
      messages: [],
      timestamp: Date.now(),
      updatedAt: new Date().toISOString()
    };
    
    this.sessions.update(prev => [newSession, ...prev]);
    this.currentSessionId.set(newId);
    this.messages.set([]);
    this.inputMessage.set('');
    this.selectedFile.set(null);
    this.geminiService.startNewChat(this.currentLang());
    this.abortController = null;
    
    if (this.textarea?.nativeElement) {
      this.textarea.nativeElement.style.height = 'auto';
    }

    if (closeSidebar) this.isSidebarOpen.set(false);
  }

  loadSession(id: string, closeSidebar = true) {
    const session = this.sessions().find(s => s.id === id);
    if (session) {
      this.currentSessionId.set(id);
      this.messages.set([...session.messages]);
      this.geminiService.startNewChat(this.currentLang()); 
      if (closeSidebar) this.isSidebarOpen.set(false);
      this.scrollToBottom();
    }
  }

  updateSessionMessages(id: string, msgs: ChatMessage[]) {
    this.sessions.update(prev => prev.map(s => {
      if (s.id === id) {
        let title = s.title;
        const isDefault = s.title === 'محادثة جديدة' || s.title === 'New Chat';
        if (isDefault && msgs.length > 0) {
           const firstUserMsg = msgs.find(m => m.role === 'user');
           if (firstUserMsg) {
             title = firstUserMsg.text.substring(0, 30) + (firstUserMsg.text.length > 30 ? '...' : '');
           }
        }
        return { ...s, messages: msgs, title, updatedAt: new Date().toISOString() };
      }
      return s;
    }));
  }

  deleteSession(event: Event, id: string) {
    event.stopPropagation();
    if(confirm(this.t().deleteConfirm)) {
      this.sessions.update(prev => prev.filter(s => s.id !== id));
      if (this.currentSessionId() === id) {
        if (this.sessions().length > 0) {
          this.loadSession(this.sessions()[0].id, false);
        } else {
          this.createNewChat(false);
        }
      }
      if (this.sessions().length === 0) {
        localStorage.removeItem('aman_sessions_v1');
      }
    }
  }

  exportChat() {
    const msgs = this.messages();
    if (msgs.length === 0) return;

    let textContent = `Aman AI Chat Export - ${new Date().toLocaleString()}\n\n`;
    msgs.forEach(msg => {
      const role = msg.role === 'user' ? 'You' : 'Aman';
      textContent += `[${role}]:\n${msg.text}\n\n${'-'.repeat(40)}\n\n`;
    });

    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Aman-Chat-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
    this.isSidebarOpen.set(false);
  }

  startVoiceInput() {
    if (this.voiceMode()) return;
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = this.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      this.isListening.set(true);
    };

    recognition.onend = () => {
      this.isListening.set(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      this.inputMessage.set((this.inputMessage() + ' ' + transcript).trim());
      if (this.textarea?.nativeElement) {
        this.textarea.nativeElement.style.height = 'auto';
        this.textarea.nativeElement.style.height = Math.min(this.textarea.nativeElement.scrollHeight, 150) + 'px';
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech error', event.error);
      this.isListening.set(false);
    };

    recognition.start();
  }

  toggleVoiceMode() {
    if (!this.authService.user()) {
      this.showAuthModal.set(true);
      return;
    }
    if (this.voiceMode()) {
      this.stopVoiceMode();
      return;
    }
    this.startVoiceMode();
  }

  private async startVoiceMode() {
    this.voiceMode.set(true);
    this.voiceSpeaking.set(false);
    this.isListening.set(false);
    this.liveListening.set(false);
    this.liveMuted.set(false);
    this.liveError.set('');
    this.liveHasOutputTranscription = false;
    this.liveUserMsgIndex = null;
    this.liveModelMsgIndex = null;
    this.liveUserPreview.set('');
    this.liveModelPreview.set('');
    this.ensureOutputContext(this.LIVE_OUTPUT_RATE);

    try {
      const wsUrl = await this.buildLiveWsUrl();
      this.openLiveWebSocket(wsUrl);
    } catch (e) {
      console.error('Live voice start failed', e);
      this.voiceMode.set(false);
      alert('تعذّر تشغيل اللايف حالياً. جرّب بعد قليل.');
    }
  }

  stopVoiceMode() {
    this.voiceMode.set(false);
    this.isListening.set(false);
    this.voiceSpeaking.set(false);
    this.liveReady.set(false);
    this.liveError.set('');
    this.liveMuted.set(false);
    this.liveListening.set(false);
    this.liveClosing = true;

    if (this.liveWs) {
      try {
        if (this.liveWs.readyState === WebSocket.OPEN) {
          this.liveWs.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
        }
        this.liveWs.close();
      } catch {
        // ignore
      }
    }
    this.liveWs = null;

    this.stopMicStream();
    this.resetPlayback();
  }

  toggleLiveMute() {
    this.liveMuted.update((v) => !v);
    if (this.liveMuted()) {
      this.liveListening.set(false);
    } else if (this.voiceMode() && this.micStream) {
      this.liveListening.set(true);
    }
  }

  private async buildLiveWsUrl(): Promise<string> {
    const token = await this.geminiService.getLiveToken();
    if (token) {
      return `${this.LIVE_WS_V1ALPHA_CONSTRAINED}?access_token=${encodeURIComponent(token)}`;
    }

    const apiKey = this.getLiveApiKey();
    if (apiKey) {
      return `${this.LIVE_WS_V1BETA}?key=${encodeURIComponent(apiKey)}`;
    }

    throw new Error('Missing live token');
  }

  private getLiveApiKey(): string | null {
    const fromWindow = (window as any)?.AMAN_LIVE_API_KEY as string | undefined;
    if (fromWindow && fromWindow.trim()) return fromWindow.trim();
    const fromStorage = localStorage.getItem('aman_live_api_key');
    if (fromStorage && fromStorage.trim()) return fromStorage.trim();
    return null;
  }

  private openLiveWebSocket(url: string) {
    if (this.liveWs) {
      try {
        this.liveWs.close();
      } catch {
        // ignore
      }
    }

    this.liveReady.set(false);
    this.liveClosing = false;
    this.liveError.set('');

    const ws = new WebSocket(url);
    this.liveWs = ws;

    ws.onopen = () => {
      this.sendLiveSetup();
    };

    ws.onmessage = (event) => {
      this.handleLiveMessage(event.data);
    };

    ws.onerror = () => {
      console.error('Live websocket error');
      this.liveError.set(this.t().error);
      if (!this.liveClosing) this.stopVoiceMode();
    };

    ws.onclose = () => {
      if (this.liveClosing) {
        this.liveClosing = false;
        return;
      }
      this.stopVoiceMode();
    };
  }

  private sendLiveSetup() {
    if (!this.liveWs || this.liveWs.readyState !== WebSocket.OPEN) return;

    const setup: any = {
      setup: {
        model: `models/${this.LIVE_MODEL}`,
        generationConfig: {
          responseModalities: ['AUDIO']
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        realtimeInputConfig: {
          automaticActivityDetection: {}
        }
      }
    };

    const customInstruction = this.buildCustomInstruction();
    if (customInstruction) {
      setup.setup.systemInstruction = { parts: [{ text: customInstruction }] };
    }

    this.liveWs.send(JSON.stringify(setup));
  }

  private handleLiveMessage(raw: string) {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.setupComplete) {
      this.liveReady.set(true);
      this.liveError.set('');
      void this.startMicStream();
      return;
    }

    const serverContent = msg.serverContent;

    if (serverContent?.interrupted) {
      this.resetPlayback();
    }

    const inputTx = msg.inputTranscription || serverContent?.inputTranscription;
    if (inputTx?.text) {
      this.setLiveUserText(String(inputTx.text));
    }

    const outputTx = msg.outputTranscription || serverContent?.outputTranscription;
    if (outputTx?.text) {
      this.liveHasOutputTranscription = true;
      this.setLiveModelText(String(outputTx.text), true);
    }

    const modelTurn = serverContent?.modelTurn;
    if (modelTurn?.parts && Array.isArray(modelTurn.parts)) {
      for (const part of modelTurn.parts) {
        if (part?.text && !this.liveHasOutputTranscription) {
          this.setLiveModelText(String(part.text), false);
        }

        const inline = part?.inlineData || part?.inline_data || part?.inline;
        const audioData = inline?.data || part?.audio?.data || part?.audioData || part?.data;
        const mimeType = inline?.mimeType || inline?.mime_type || part?.mimeType || part?.type;
        if (audioData && typeof audioData === 'string') {
          this.handleLiveAudioChunk(audioData, mimeType);
        }
      }
    }

    if (serverContent?.turnComplete || serverContent?.generationComplete) {
      this.finalizeLiveTurn();
    }
  }

  private async startMicStream() {
    if (this.micStream || !this.voiceMode()) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.micStream = stream;
      const ctx = new AudioContext();
      this.micContext = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const mute = ctx.createGain();
      mute.gain.value = 0;

      source.connect(processor);
      processor.connect(mute);
      mute.connect(ctx.destination);

      this.micSource = source;
      this.micProcessor = processor;
      this.micMuteGain = mute;
      this.liveListening.set(!this.liveMuted());

      processor.onaudioprocess = (event) => {
        if (!this.voiceMode() || this.liveMuted() || !this.liveWs || this.liveWs.readyState !== WebSocket.OPEN || !this.liveReady()) return;
        if (this.liveWs.bufferedAmount > 1_000_000) return;

        const input = event.inputBuffer.getChannelData(0);
        const downsampled = this.downsampleBuffer(input, ctx.sampleRate, this.LIVE_INPUT_RATE);
        if (!downsampled.length) return;

        const pcm16 = this.floatTo16BitPCM(downsampled);
        const base64 = this.arrayBufferToBase64(pcm16.buffer);
        const payload = {
          realtimeInput: {
            audio: {
              data: base64,
              mimeType: `audio/pcm;rate=${this.LIVE_INPUT_RATE}`
            }
          }
        };
        this.liveWs.send(JSON.stringify(payload));
      };
    } catch (e) {
      console.error('Mic start failed', e);
      this.isListening.set(false);
      this.liveError.set(this.t().error);
      this.stopVoiceMode();
      alert('Microphone permission is required for live voice.');
    }
  }

  private stopMicStream() {
    if (this.micProcessor) {
      try {
        this.micProcessor.disconnect();
      } catch {
        // ignore
      }
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {
        // ignore
      }
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
    }
    if (this.micContext) {
      this.micContext.close().catch(() => undefined);
    }

    this.micStream = null;
    this.micSource = null;
    this.micProcessor = null;
    this.micContext = null;
    this.micMuteGain = null;
    this.liveListening.set(false);
  }

  private handleLiveAudioChunk(data: string, mimeType?: string) {
    const clean = this.stripDataUrlPrefix(data);
    if (!clean) return;
    const pcm16 = this.base64ToInt16(clean);
    if (pcm16.length === 0) return;

    const rate = this.extractSampleRate(mimeType) || this.LIVE_OUTPUT_RATE;
    this.schedulePcmPlayback(pcm16, rate);
  }

  private ensureOutputContext(sampleRate: number): AudioContext {
    if (!this.outputContext || this.outputContext.sampleRate !== sampleRate) {
      if (this.outputContext) {
        this.outputContext.close().catch(() => undefined);
      }
      this.outputContext = new AudioContext({ sampleRate });
      this.outputNextTime = this.outputContext.currentTime;
      this.outputSources = [];
    }

    if (this.outputContext.state === 'suspended') {
      this.outputContext.resume().catch(() => undefined);
    }

    return this.outputContext;
  }

  private schedulePcmPlayback(pcm16: Int16Array, sampleRate: number) {
    const ctx = this.ensureOutputContext(sampleRate);
    const buffer = ctx.createBuffer(1, pcm16.length, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm16.length; i++) {
      channel[i] = pcm16[i] / 32768;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, this.outputNextTime);
    source.start(startAt);
    this.outputNextTime = startAt + buffer.duration;
    this.outputSources.push(source);
    this.voiceSpeaking.set(true);

    source.onended = () => {
      this.outputSources = this.outputSources.filter((s) => s !== source);
      if (this.outputSources.length === 0 && this.outputNextTime <= ctx.currentTime + 0.05) {
        this.voiceSpeaking.set(false);
      }
    };
  }

  private resetPlayback() {
    for (const source of this.outputSources) {
      try {
        source.stop();
      } catch {
        // ignore
      }
    }
    this.outputSources = [];
    this.outputNextTime = 0;
    if (this.outputContext) {
      this.outputContext.close().catch(() => undefined);
      this.outputContext = null;
    }
    this.voiceSpeaking.set(false);
  }

  private setLiveUserText(text: string) {
    const clean = text.trim();
    if (!clean) return;
    this.liveUserPreview.set(clean);
    if (this.liveUserMsgIndex === null) {
      const idx = this.messages().length;
      this.messages.update((prev) => [...prev, { role: 'user', text: clean }]);
      this.liveUserMsgIndex = idx;
    } else {
      const idx = this.liveUserMsgIndex;
      this.messages.update((prev) => {
        const next = [...prev];
        if (idx !== null && idx < next.length) {
          next[idx] = { ...next[idx], text: clean };
        }
        return next;
      });
    }
    this.scrollToBottom();
  }

  private setLiveModelText(text: string, replace: boolean) {
    const clean = text.trim();
    if (!clean) return;
    if (this.liveModelMsgIndex === null) {
      const idx = this.messages().length;
      this.messages.update((prev) => [...prev, { role: 'model', text: clean }]);
      this.liveModelMsgIndex = idx;
      this.liveModelPreview.set(clean);
    } else if (replace) {
      const idx = this.liveModelMsgIndex;
      this.messages.update((prev) => {
        const next = [...prev];
        if (idx !== null && idx < next.length) {
          next[idx] = { ...next[idx], text: clean };
        }
        return next;
      });
      this.liveModelPreview.set(clean);
    } else {
      const idx = this.liveModelMsgIndex;
      this.messages.update((prev) => {
        const next = [...prev];
        if (idx !== null && idx < next.length) {
          const current = next[idx]?.text || '';
          const combined = current + clean;
          next[idx] = { ...next[idx], text: combined };
          this.liveModelPreview.set(combined);
        }
        return next;
      });
    }
    this.scrollToBottom();
  }

  private finalizeLiveTurn() {
    this.liveUserMsgIndex = null;
    this.liveModelMsgIndex = null;
    this.liveHasOutputTranscription = false;
    this.syncChatToFirestore();
  }

  private downsampleBuffer(buffer: Float32Array, inputRate: number, targetRate: number): Float32Array {
    if (targetRate === inputRate) return buffer;
    const ratio = inputRate / targetRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offset = 0;

    for (let i = 0; i < newLength; i++) {
      const nextOffset = Math.round((i + 1) * ratio);
      let sum = 0;
      let count = 0;
      for (let j = offset; j < nextOffset && j < buffer.length; j++) {
        sum += buffer[j];
        count++;
      }
      result[i] = count ? sum / count : 0;
      offset = nextOffset;
    }

    return result;
  }

  private floatTo16BitPCM(buffer: Float32Array): Int16Array {
    const output = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  private arrayBufferToBase64(buffer: ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToInt16(base64: string): Int16Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
  }

  private stripDataUrlPrefix(input: string): string {
    const idx = input.indexOf('base64,');
    return idx >= 0 ? input.slice(idx + 7) : input.trim();
  }

  private extractSampleRate(mimeType?: string): number | null {
    if (!mimeType) return null;
    const match = mimeType.match(/rate=(\d+)/i);
    if (match && match[1]) return parseInt(match[1], 10);
    return null;
  }

  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

  openSettings() {
    this.showSettingsModal.set(true);
    this.showProfileModal.set(false);
    this.isSidebarOpen.set(false);
  }

  openProfileModal() {
    this.showSettingsModal.set(false);
    this.showProfileModal.set(true);
  }

  backToSettings() {
    this.showProfileModal.set(false);
    this.showSettingsModal.set(true);
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      if (this.scrollContainer?.nativeElement) {
        this.scrollContainer.nativeElement.scrollTo({
          top: this.scrollContainer.nativeElement.scrollHeight,
          behavior: 'auto'
        });
      }
    });
  }

  updateInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.inputMessage.set(target.value);
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 150) + 'px';
  }

  triggerFileUpload() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const base64Data = (e.target?.result as string).split(',')[1];
        this.selectedFile.set({
          name: file.name,
          mimeType: file.type,
          data: base64Data
        });
        input.value = '';
      };
      reader.readAsDataURL(file);
    }
  }

  clearFile() {
    this.selectedFile.set(null);
  }

  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      this.isLoading.set(false);
      
      this.messages.update(prev => {
        const last = prev[prev.length - 1];
        if (last.role === 'model' && !last.text) {
          return [...prev.slice(0, -1), { role: 'model', text: '...' }];
        }
        return prev;
      });
      this.syncChatToFirestore();
    }
  }

  async sendMessage() {
    if (!this.authService.user()) {
      this.showAuthModal.set(true);
      return;
    }

    const text = this.inputMessage().trim();
    const file = this.selectedFile();
    
    if ((!text && !file) || this.isLoading()) return;

    const estimatedTokens = Math.ceil((text.length + (file ? 1000 : 0)) / 4) + 10;
    const allowed = await this.authService.checkAndIncrementUsage(estimatedTokens);
    
    if (!allowed) {
      alert(this.t().limitReached);
      return;
    }

    this.messages.update(prev => [
      ...prev, 
      { 
        role: 'user', 
        text: text, 
        fileData: file ? { name: file.name, mimeType: file.mimeType, data: file.data } : undefined 
      }
    ]);
    
    const currentHistory = this.messages();

    this.inputMessage.set('');
    this.selectedFile.set(null);
    this.isLoading.set(true);
    
    this.abortController = new AbortController();
    
    if (this.textarea?.nativeElement) this.textarea.nativeElement.style.height = 'auto';
    this.scrollToBottom();

    try {
        const aiMsgIndex = this.messages().length;
        
        this.messages.update(prev => [...prev, { role: 'model', text: '' }]);
        
        const response = await this.geminiService.sendMessage(
          currentHistory, 
          false,
          this.abortController.signal,
          {
            modelKey: this.modelKey(),
            customInstruction: this.buildCustomInstruction()
          }
        );

        let responseText = response.text;
        const generatedImages = response.images;

        // Force update images first if they exist
        if (generatedImages && generatedImages.length > 0) {
           this.messages.update(msgs => {
             const newMsgs = [...msgs];
             if (aiMsgIndex < newMsgs.length) {
                newMsgs[aiMsgIndex] = {
                  ...newMsgs[aiMsgIndex],
                  generatedImages: generatedImages
                };
             }
             return newMsgs;
           });

           // Persist images to storage (DB) and replace data URLs with CDN URLs
           this.persistGeneratedImages(aiMsgIndex, generatedImages);
        }
        
        if (!responseText && (!generatedImages || generatedImages.length === 0)) {
           responseText = this.currentLang() === 'ar' ? 'عذراً، لم أتلقى إجابة.' : 'Sorry, no response received.';
        }

        const style = this.responseStyle();
        const typingSpeed = style === 'smooth' ? 12 : 0;

        if (style === 'instant') {
          this.messages.update(msgs => {
            const newMsgs = [...msgs];
            if (aiMsgIndex < newMsgs.length) {
              newMsgs[aiMsgIndex] = { 
                ...newMsgs[aiMsgIndex], 
                text: responseText
              };
            }
            return newMsgs;
          });
        } else {
          for (let i = 0; i < responseText.length; i++) {
             if (this.currentSessionId() !== this.sessions().find(s => s.id === this.currentSessionId())?.id) break;
             
             if (!this.isLoading() && !this.abortController) break; 

             const char = responseText[i];
             
             this.messages.update(msgs => {
                const newMsgs = [...msgs];
                if (aiMsgIndex < newMsgs.length) {
                   const currentMsg = newMsgs[aiMsgIndex];
                   newMsgs[aiMsgIndex] = { 
                     ...currentMsg, 
                     text: (currentMsg.text || '') + char
                   };
                }
                return newMsgs;
             });
             
             if (i % 5 === 0) this.scrollToBottom();
             if (typingSpeed > 0) {
               await new Promise(resolve => setTimeout(resolve, typingSpeed));
             }
          }
        }

        this.scrollToBottom();
      
    } catch (error: any) {
      if (error.message !== 'تم إيقاف التوليد.') {
        console.error('Action failed', error);
        let errText = error.message || this.t().error;
        if (/JSON|response format|Unexpected end/i.test(errText)) {
          errText = this.t().error;
        }
        if (/gemini|imagen/i.test(errText)) {
          errText = this.t().error;
        }
        this.messages.update(msgs => {
          const last = msgs[msgs.length - 1];
          if (last.role === 'model' && !last.text) {
              const newMsgs = [...msgs];
              newMsgs[newMsgs.length - 1] = { role: 'system', text: errText, isError: true };
              return newMsgs;
          }
          return [...msgs, { role: 'system', text: errText, isError: true }];
        });
      }
    } finally {
      this.isLoading.set(false);
      this.abortController = null;
      this.scrollToBottom();
      this.syncChatToFirestore();
    }
  }

  handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  async syncChatToFirestore() {
    const user = this.authService.user();
    if (!user) return;

    try {
      const sessionId = this.currentSessionId();
      const session = this.sessions().find(s => s.id === sessionId);
      if (!session) return;

      const db = this.authService.db;
      const chatDocRef = doc(db, 'users', user.uid, 'chats', sessionId);
      
      const cleanMessages = this.sanitizeMessagesForStorage(session.messages);

      await setDoc(chatDocRef, {
        id: sessionId,
        title: session.title,
        timestamp: session.timestamp,
        messages: cleanMessages,
        updatedAt: new Date().toISOString()
      }, { merge: true });

    } catch (e) {
      console.error('Failed to sync chat to DB', e);
    }
  }

  private persistSessions(allSessions: ChatSession[]) {
    try {
      const safeSessions = allSessions.map(s => ({
        ...s,
        messages: this.sanitizeMessagesForStorage(s.messages)
      }));
      localStorage.setItem('aman_sessions_v1', JSON.stringify(safeSessions));
    } catch (e) {
      console.warn('Failed to persist sessions (possibly storage limit).', e);
    }
  }

  private sanitizeMessagesForStorage(messages: ChatMessage[]): ChatMessage[] {
    return messages.map(msg => {
      const clean: any = { ...msg };

      if (clean.fileData) {
        clean.fileData = {
          name: clean.fileData.name,
          mimeType: clean.fileData.mimeType
        };
      }

      if (clean.generatedImages) {
        const kept = clean.generatedImages.filter((img: any) => img?.url && !img.url.startsWith('data:'));
        if (kept.length > 0) {
          clean.generatedImages = kept.map((img: any) => ({
            url: img.url,
            mimeType: img.mimeType,
            alt: img.alt
          }));
        } else {
          delete clean.generatedImages;
        }
      }

      if (clean.isError === undefined) delete clean.isError;
      return JSON.parse(JSON.stringify(clean));
    });
  }

  private getSessionUpdatedAt(session: ChatSession): number {
    if (session.updatedAt) {
      const parsed = Date.parse(session.updatedAt);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return session.timestamp || 0;
  }

  private sessionHasImages(session: ChatSession): boolean {
    return session.messages?.some(m => Array.isArray(m.generatedImages) && m.generatedImages.length > 0) || false;
  }

  private async persistGeneratedImages(index: number, images: { url: string; mimeType: string; alt?: string }[]) {
    const user = this.authService.user();
    if (!user || !images || images.length === 0) return;

    const updated = await Promise.all(images.map(async (img) => {
      if (!img?.url) return img;
      if (!img.url.startsWith('data:')) return img;

      const uploaded = await this.authService.uploadGeneratedImage(user.uid, img.url, img.mimeType);
      if (!uploaded) return img;
      return { ...img, url: uploaded };
    }));

    const changed = updated.some((img, i) => img.url !== images[i]?.url);
    if (!changed) return;

    this.messages.update(msgs => {
      const newMsgs = [...msgs];
      if (index < newMsgs.length) {
        newMsgs[index] = { ...newMsgs[index], generatedImages: updated };
      }
      return newMsgs;
    });

    this.syncChatToFirestore();
  }
}
