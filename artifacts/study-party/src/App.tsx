import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Flame,
  Globe2,
  Headphones,
  Info,
  Lock,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  MoreHorizontal,
  Plus,
  Radio,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Type,
  Users,
  Video,
  VideoOff,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import {
  getGetDashboardQueryKey,
  getGetPartyQueryKey,
  getListPartyMessagesQueryKey,
  getListPartiesQueryKey,
  useChatWithAssistant,
  useCreateParty,
  useCreatePartyMessage,
  useGetDashboard,
  useGetParty,
  useJoinParty,
  useListParties,
  useListPartyMessages,
} from '@workspace/api-client-react';
import type { Party, PartyMessage } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in app environment');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: 'top' as const,
    socialButtonsVariant: 'auto' as const,
  },
  variables: {
    colorPrimary: '#F47C65',
    colorForeground: '#242043',
    colorMutedForeground: '#756f83',
    colorDanger: '#C84E4E',
    colorBackground: '#FFFCF7',
    colorInput: '#FAF7F1',
    colorInputForeground: '#242043',
    colorNeutral: '#E6DED3',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.85rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#FFFCF7] rounded-[1.5rem] w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-display text-[#242043]',
    headerSubtitle: 'text-[#756f83]',
    socialButtonsBlockButtonText: 'text-[#242043]',
    formFieldLabel: 'text-[#242043]',
    footerActionLink: 'text-[#D85F4F]',
    footerActionText: 'text-[#756f83]',
    dividerText: 'text-[#756f83]',
    identityPreviewEditButton: 'text-[#D85F4F]',
    formFieldSuccessText: 'text-[#2D8577]',
    alertText: 'text-[#242043]',
    logoBox: 'rounded-2xl overflow-hidden',
    logoImage: 'rounded-2xl',
    socialButtonsBlockButton: 'border-[#E6DED3] bg-[#FAF7F1] hover:bg-[#F4EEE6]',
    formButtonPrimary: 'bg-[#F47C65] text-[#242043] hover:bg-[#E96C58]',
    formFieldInput: 'border-[#E6DED3] bg-[#FAF7F1] text-[#242043]',
    footerAction: 'border-[#E6DED3]',
    dividerLine: 'bg-[#E6DED3]',
    alert: 'border-[#F0C9C0] bg-[#FFF2EE]',
    otpCodeFieldInput: 'border-[#E6DED3] bg-[#FAF7F1] text-[#242043]',
    formFieldRow: 'text-[#242043]',
    main: 'bg-transparent',
  },
};

const accents = [
  { name: 'Coral', value: '#F47C65' },
  { name: 'Teal', value: '#4DB6A5' },
  { name: 'Gold', value: '#F2C94C' },
  { name: 'Iris', value: '#8075D6' },
];

type Visibility = 'public' | 'private';
type ThemeName = 'citrus' | 'ocean' | 'lavender';
type FontSize = 'small' | 'medium' | 'large';
type Preferences = {
  profileName: string;
  profileBio: string;
  profileTone: string;
  theme: ThemeName;
  fontSize: FontSize;
  accentColor: string;
  assistantName: string;
  reduceMotion: boolean;
};

const defaultPreferences: Preferences = {
  profileName: 'Alex Morgan',
  profileBio: 'Focus explorer',
  profileTone: '#F2C94C',
  theme: 'citrus',
  fontSize: 'medium',
  accentColor: '#F47C65',
  assistantName: 'Orbit',
  reduceMotion: false,
};

function loadPreferences(): Preferences {
  try {
    const saved = window.localStorage.getItem('study-party-preferences');
    return saved ? { ...defaultPreferences, ...JSON.parse(saved) } : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

function hslFromHex(hex: string) {
  const value = hex.replace('#', '');
  const red = parseInt(value.slice(0, 2), 16) / 255;
  const green = parseInt(value.slice(2, 4), 16) / 255;
  const blue = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;
  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue /= 6;
  }
  return `${Math.round(hue * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

const fallbackParties: Party[] = [
  { id: 101, name: 'Cram & Cocoa', subject: 'Chemistry', description: 'Quiet review before Friday’s equilibrium quiz.', host: 'Mina Park', accent: '#F47C65', visibility: 'public', memberCount: 7, maxMembers: 10, isLive: true, isPremium: false, createdAt: new Date().toISOString() },
  { id: 102, name: 'The Essay Edit', subject: 'English', description: 'Bring a draft. Leave with a sharper argument.', host: 'Jon Bell', accent: '#4DB6A5', visibility: 'public', memberCount: 4, maxMembers: 8, isLive: true, isPremium: true, createdAt: new Date().toISOString() },
  { id: 103, name: 'Vectors & Vinyl', subject: 'Math', description: 'Problem sets with a low-volume shared playlist.', host: 'Sofia Reyes', accent: '#8075D6', visibility: 'public', memberCount: 5, maxMembers: 12, isLive: false, isPremium: false, createdAt: new Date().toISOString() },
];

function initials(name = 'Study friend') {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function timeAgo(value: string) {
  const delta = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (delta < 60) return `${delta}m ago`;
  if (delta < 1440) return `${Math.floor(delta / 60)}h ago`;
  return `${Math.floor(delta / 1440)}d ago`;
}

function Shell({ children, onAssistant, onSearch, preferences }: { children: ReactNode; onAssistant: () => void; onSearch: () => void; preferences: Preferences }) {
  const [location] = useLocation();
  const onRoom = location.startsWith('/party/');
  const { user } = useUser();
  const profileName = user?.fullName || preferences.profileName;
  return (
    <div className="min-h-[100dvh] bg-background text-foreground lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden lg:flex flex-col bg-sidebar text-sidebar-foreground px-5 py-6">
        <Link href="/" className="flex items-center gap-3 mb-11" data-testid="link-brand">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm rotate-[-6deg]">
            <Zap size={20} strokeWidth={2.7} />
          </span>
          <span className="font-display text-[20px] font-bold tracking-[-.04em]">study party</span>
        </Link>
        <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-sidebar-foreground/45">Your space</div>
        <nav className="space-y-1" aria-label="Primary navigation">
          <Link href="/" className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-200 ${!onRoom ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`} data-testid="link-dashboard">
            <LayoutDashboard size={18} />
            Discover parties
          </Link>
          <button onClick={onAssistant} className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-sidebar-foreground/65 transition-all duration-200 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground" data-testid="button-open-assistant-sidebar">
            <Sparkles size={18} />
            Study assistant
            <span className="ml-auto rounded-md bg-sidebar-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-sidebar-primary">AI</span>
          </button>
          <Link href="/profile" className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-200 ${location === '/profile' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`} data-testid="link-profile">
            <Users size={18} />
            My profile
          </Link>
          <Link href="/settings" className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-200 ${location === '/settings' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`} data-testid="link-settings">
            <Settings size={18} />
            Settings
          </Link>
          <Link href="/about" className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-200 ${location === '/about' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`} data-testid="link-about">
            <Info size={18} />
            About Study Party
          </Link>
        </nav>
        <div className="mt-auto">
          <div className="relative overflow-hidden rounded-2xl bg-sidebar-accent p-4">
            <div className="absolute -right-7 -top-8 h-24 w-24 rounded-full bg-sidebar-primary/20 blur-xl" />
            <div className="relative">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Flame size={16} /></div>
              <p className="text-sm font-bold">Small sessions add up</p>
              <p className="mt-1 text-xs leading-relaxed text-sidebar-foreground/55">Join a room, set a short goal, and see where the next 25 minutes takes you.</p>
            </div>
          </div>
          <div className="mt-3 flex gap-3 px-1 text-[10px] text-sidebar-foreground/40"><Link href="/privacy" data-testid="link-privacy">Privacy</Link><Link href="/terms" data-testid="link-terms">Terms</Link></div>
          <div className="mt-5 flex items-center gap-3 border-t border-sidebar-border pt-5">
             <Avatar name={profileName} tone={preferences.profileTone} />
             <div className="min-w-0"><p className="truncate text-sm font-semibold">{profileName}</p><p className="text-xs text-sidebar-foreground/45">{user ? 'Signed in' : (preferences.profileBio || 'Focus explorer')}</p></div>
             <Link href="/profile" className="ml-auto text-sidebar-foreground/45 hover:text-sidebar-foreground" data-testid="button-profile-options" aria-label="Profile options"><MoreHorizontal size={17} /></Link>
          </div>
        </div>
      </aside>
      <main className="min-w-0">
        <header className="flex h-[72px] items-center justify-between border-b border-border bg-card/75 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Link href="/" className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground" data-testid="link-mobile-brand"><Zap size={18} /></Link>
            <span className="font-display text-lg font-bold tracking-[-.04em]">study party</span>
          </div>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
            <span className="h-2 w-2 rounded-full bg-secondary-foreground" />
            <span>Library quiet hours</span>
            <span className="text-border">/</span>
            <span className="font-semibold text-foreground">On until 9:00 PM</span>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
             <button onClick={onSearch} className="hidden items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-foreground sm:flex" data-testid="button-search">
              <Search size={15} /> Search
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[9px]">⌘ K</span>
            </button>
             <Link href="/settings" className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-background text-muted-foreground transition hover:border-primary/50 hover:text-foreground sm:hidden" data-testid="link-mobile-settings" aria-label="Settings"><Settings size={15} /></Link>
            <button onClick={onAssistant} className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0" data-testid="button-open-assistant-header">
              <Sparkles size={15} /> <span className="hidden sm:inline">Ask assistant</span><span className="sm:hidden">Ask</span>
            </button>
          </div>
        </header>
        <div className="study-grid min-h-[calc(100dvh-72px)]">{children}</div>
      </main>
    </div>
  );
}

function Avatar({ name, tone = '#F47C65', size = 'normal' }: { name: string; tone?: string; size?: 'normal' | 'large' }) {
  return <span className={`grid shrink-0 place-items-center rounded-xl font-display font-bold text-foreground ${size === 'large' ? 'h-12 w-12 text-sm' : 'h-8 w-8 text-[10px]'}`} style={{ backgroundColor: tone }} data-testid={`avatar-${name.replace(/\s+/g, '-').toLowerCase()}`}>{initials(name)}</span>;
}

function StatTile({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone: string }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card/80 p-4 shadow-xs transition hover:-translate-y-0.5 hover:shadow-sm" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${tone}26`, color: tone }}>{icon}</span>
    <div className="min-w-0"><div className="font-display text-xl font-bold tracking-[-.04em]">{value}</div><div className="truncate text-xs font-semibold text-muted-foreground">{label}</div></div>
    <span className="ml-auto hidden text-[10px] font-bold text-secondary-foreground sm:block">{detail}</span>
  </div>;
}

function PartyCard({ party, onJoin }: { party: Party; onJoin: (party: Party) => void }) {
  return <article className="group relative overflow-hidden rounded-[22px] border border-border bg-card p-5 shadow-xs transition duration-300 hover:-translate-y-1 hover:shadow-lg" data-testid={`card-party-${party.id}`}>
    <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: party.accent || '#F47C65' }} />
    <div className="flex items-start justify-between gap-3">
      <span className="rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.13em]" style={{ backgroundColor: `${party.accent || '#F47C65'}22`, color: party.accent || '#F47C65' }}>{party.subject}</span>
      {party.visibility === 'private' ? <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground"><Lock size={11} /> Private</span> : party.isLive ? <span className="flex items-center gap-1.5 rounded-full bg-secondary/55 px-2.5 py-1 text-[10px] font-bold text-secondary-foreground"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary-foreground" /> Live now</span> : <span className="text-[10px] font-semibold text-muted-foreground">{timeAgo(party.createdAt)}</span>}
    </div>
    <h3 className="mt-5 font-display text-[21px] font-bold tracking-[-.045em]">{party.name}</h3>
    <p className="mt-2 min-h-[40px] text-sm leading-relaxed text-muted-foreground">{party.description}</p>
    <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
      <div className="flex items-center gap-2"><Avatar name={party.host} tone={party.accent || '#F47C65'} /><div><p className="text-xs font-bold">{party.host}</p><p className="text-[10px] text-muted-foreground">Host</p></div></div>
      <div className="text-right"><p className="font-display text-sm font-bold">{party.memberCount}<span className="font-sans text-muted-foreground">/{party.maxMembers}</span></p><p className="text-[10px] text-muted-foreground">studying</p></div>
    </div>
    <button onClick={() => onJoin(party)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-xs font-bold transition group-hover:border-primary/50 group-hover:bg-primary group-hover:text-primary-foreground" data-testid={`button-join-party-${party.id}`}>
      {party.isLive ? 'Join the focus room' : 'See party details'} <ArrowUpRight size={14} />
    </button>
  </article>;
}

function SkeletonCard() {
  return <div className="h-[257px] animate-pulse rounded-[22px] border border-border bg-card/80 p-5"><div className="h-6 w-24 rounded-lg bg-muted" /><div className="mt-6 h-7 w-44 rounded-md bg-muted" /><div className="mt-3 h-10 w-full rounded-md bg-muted" /><div className="mt-6 h-px bg-muted" /><div className="mt-4 h-8 w-36 rounded-md bg-muted" /></div>;
}

function EmptyParties({ onCreate }: { onCreate: () => void }) {
  return <div className="col-span-full rounded-[24px] border border-dashed border-border bg-card/60 px-6 py-16 text-center" data-testid="empty-parties">
    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent/60 text-accent-foreground"><Compass size={24} /></span>
    <h3 className="mt-5 font-display text-xl font-bold">A quiet corner, waiting for you</h3>
    <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Start a party for your next assignment, or check back when classmates open their rooms.</p>
    <button onClick={onCreate} className="mt-6 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" data-testid="button-create-empty-party">Start a party</button>
  </div>;
}

function DashboardPage({ onAssistant }: { onAssistant: () => void }) {
  const queryClient = useQueryClient();
  const dashboardQuery = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey(), refetchInterval: 5000, refetchIntervalInBackground: true } });
  const partiesQuery = useListParties({ query: { queryKey: getListPartiesQueryKey(), refetchInterval: 5000, refetchIntervalInBackground: true } });
  const createParty = useCreateParty();
  const joinParty = useJoinParty();
  const [, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [joinTarget, setJoinTarget] = useState<Party | null>(null);
  const [memberName, setMemberName] = useState('Alex Morgan');
  const [search, setSearch] = useState('');
  const [createForm, setCreateForm] = useState({ name: '', subject: '', description: '', host: 'Alex Morgan', maxMembers: '8', accent: accents[0].value, visibility: 'public' as Visibility });
  const dashboard = dashboardQuery.data;
  const parties = partiesQuery.data ?? dashboard?.recentParties ?? [];
  const filteredParties = useMemo(() => parties.filter((party) => `${party.name} ${party.subject} ${party.description}`.toLowerCase().includes(search.toLowerCase())), [parties, search]);

  const refreshDashboard = () => {
    queryClient.invalidateQueries({ queryKey: getListPartiesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };
  const submitCreate = (event: FormEvent) => {
    event.preventDefault();
     createParty.mutate({ data: { ...createForm, maxMembers: Number(createForm.maxMembers) } }, {
      onSuccess: (party) => {
        refreshDashboard();
        setShowCreate(false);
         setCreateForm({ name: '', subject: '', description: '', host: 'Alex Morgan', maxMembers: '8', accent: accents[0].value, visibility: 'public' });
        setLocation(`/party/${party.id}`);
      },
    });
  };
  const submitJoin = (event: FormEvent) => {
    event.preventDefault();
    if (!joinTarget || !memberName.trim()) return;
    joinParty.mutate({ partyId: joinTarget.id, data: { memberName: memberName.trim() } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPartiesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPartyQueryKey(joinTarget.id) });
        setLocation(`/party/${joinTarget.id}`);
      },
    });
  };

  return <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-10">
    <section className="animate-rise-in grid gap-5 xl:grid-cols-[1.45fr_.55fr]">
      <div className="relative min-h-[270px] overflow-hidden rounded-[28px] bg-sidebar p-7 text-sidebar-foreground shadow-md sm:p-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[42px] border-sidebar-primary/20" />
        <div className="absolute -bottom-28 right-16 h-56 w-56 rounded-full bg-accent/10 blur-2xl" />
        <div className="relative max-w-xl">
           <div className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-sidebar-primary"><span className="h-2 w-2 rounded-full bg-sidebar-primary animate-pulse" /> {new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date())}</div>
          <h1 className="max-w-[600px] font-display text-[clamp(2.5rem,5vw,4.55rem)] font-bold leading-[.94] tracking-[-.075em]">Focus is better<br /><span className="text-sidebar-primary">together.</span></h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-sidebar-foreground/60 sm:text-base">Find your people, pick a goal, and make the next hour count.</p>
          <button onClick={() => setShowCreate(true)} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-sidebar-primary px-4 py-3 text-xs font-bold text-sidebar-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg" data-testid="button-create-party-hero"><Plus size={16} /> Create a study party</button>
        </div>
        <div className="absolute bottom-7 right-8 hidden rotate-[-8deg] rounded-2xl border border-sidebar-foreground/10 bg-sidebar-accent/80 px-4 py-3 text-center shadow-md sm:block animate-drift"><span className="block font-display text-2xl font-bold text-sidebar-primary">{dashboard?.messagesSent ?? 0}</span><span className="text-[9px] font-bold uppercase tracking-[.15em] text-sidebar-foreground/45">messages exchanged</span></div>
      </div>
      <div className="relative overflow-hidden rounded-[28px] border border-border bg-accent p-7 shadow-sm">
        <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full border-[20px] border-accent-foreground/10" />
        <div className="relative flex h-full flex-col justify-between">
          <div><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-foreground/10 text-accent-foreground"><Lightbulb size={19} /></span><p className="mt-8 max-w-[220px] font-display text-2xl font-bold leading-tight tracking-[-.05em]">Need a nudge?<br />Your assistant is ready.</p><p className="mt-3 max-w-[230px] text-sm leading-relaxed text-accent-foreground/60">Pick their name. Ask anything. Get unstuck.</p></div>
          <button onClick={onAssistant} className="mt-8 flex items-center gap-2 self-start text-xs font-bold text-accent-foreground transition hover:gap-3" data-testid="button-open-assistant-card">Open your assistant <ChevronRight size={15} /></button>
        </div>
      </div>
    </section>
    <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile icon={<Radio size={18} />} label="Live parties" value={`${dashboard?.liveCount ?? 2}`} detail="right now" tone="#F47C65" />
      <StatTile icon={<Users size={18} />} label="Students studying" value={`${dashboard?.totalMembers ?? 16}`} detail="across campus" tone="#4DB6A5" />
      <StatTile icon={<Clock3 size={18} />} label="Messages sent" value={`${dashboard?.messagesSent ?? 0}`} detail="in all parties" tone="#8075D6" />
      <StatTile icon={<Flame size={18} />} label="Study parties" value={`${dashboard?.partyCount ?? 0}`} detail="on the board" tone="#D88E2D" />
    </section>
    <section className="mt-12 animate-rise-in delay-1">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Find your focus</div><h2 className="mt-2 font-display text-3xl font-bold tracking-[-.06em]">Open study parties</h2><p className="mt-1 text-sm text-muted-foreground">Rooms with a little momentum already inside.</p></div>
        <div className="flex items-center gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 sm:w-48" placeholder="Search parties" data-testid="input-search-parties" /></div><button onClick={() => setShowCreate(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground transition hover:border-primary hover:bg-primary hover:text-primary-foreground" data-testid="button-create-party-list" aria-label="Create party"><Plus size={17} /></button></div>
      </div>
      {partiesQuery.isLoading && !parties.length ? <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div> : partiesQuery.isError && !parties.length ? <div className="mt-6 rounded-2xl border border-destructive/25 bg-destructive/5 p-8 text-center" data-testid="status-parties-error"><CircleHelp className="mx-auto text-destructive" size={26} /><p className="mt-3 font-semibold">Could not load the party board.</p><button onClick={() => partiesQuery.refetch()} className="mt-4 rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground" data-testid="button-retry-parties">Try again</button></div> : filteredParties.length ? <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredParties.map((party) => <PartyCard key={party.id} party={party} onJoin={setJoinTarget} />)}</div> : <div className="mt-6"><EmptyParties onCreate={() => setShowCreate(true)} /></div>}
    </section>
    <section className="mt-14 grid gap-5 pb-8 lg:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-[24px] border border-border bg-card/80 p-6 shadow-xs">
        <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Focus pulse</p><h3 className="mt-1 font-display text-xl font-bold tracking-[-.04em]">A good day to get into it</h3></div><span className="rounded-lg bg-secondary/45 px-2.5 py-1 text-[10px] font-bold text-secondary-foreground">This week</span></div>
        <div className="mt-7 flex h-28 items-end gap-2 sm:gap-4">{[35, 52, 42, 78, 64, 92, 70].map((height, index) => <div className="flex flex-1 flex-col items-center gap-2" key={index}><div className={`w-full max-w-9 rounded-t-lg transition-all duration-500 hover:opacity-80 ${index === 5 ? 'bg-primary' : 'bg-secondary/70'}`} style={{ height: `${height}%` }} /><span className="text-[10px] font-semibold text-muted-foreground">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span></div>)}</div>
      </div>
      <div className="rounded-[24px] border border-border bg-card/80 p-6 shadow-xs"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Your recent rooms</p><button className="text-muted-foreground transition hover:text-foreground" data-testid="button-recent-options"><MoreHorizontal size={18} /></button></div><div className="mt-5 space-y-4">{parties.slice(0, 3).map((party) => <Link href={`/party/${party.id}`} key={`recent-${party.id}`} className="flex items-center gap-3 rounded-xl transition hover:bg-muted/60" data-testid={`link-recent-party-${party.id}`}><span className="h-8 w-1 rounded-full" style={{ backgroundColor: party.accent }} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{party.name}</p><p className="text-[10px] text-muted-foreground">{party.subject} · {party.memberCount} studying</p></div><ChevronRight size={14} className="text-muted-foreground" /></Link>)}</div></div>
    </section>
    {showCreate && <CreatePartyModal form={createForm} setForm={setCreateForm} onClose={() => setShowCreate(false)} onSubmit={submitCreate} pending={createParty.isPending} />}
    {joinTarget && <JoinModal party={joinTarget} memberName={memberName} setMemberName={setMemberName} onClose={() => setJoinTarget(null)} onSubmit={submitJoin} pending={joinParty.isPending} />}
  </div>;
}

function ModalFrame({ children, onClose, title, eyebrow }: { children: ReactNode; onClose: () => void; title: string; eyebrow: string }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="animate-rise-in max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-border bg-card p-6 shadow-2xl sm:rounded-[28px]" role="dialog" aria-modal="true"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-.05em]">{title}</h2></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-muted-foreground transition hover:bg-border hover:text-foreground" data-testid="button-close-modal" aria-label="Close dialog"><X size={17} /></button></div>{children}</div></div>;
}

function CreatePartyModal({ form, setForm, onClose, onSubmit, pending }: { form: { name: string; subject: string; description: string; host: string; maxMembers: string; accent: string; visibility: Visibility }; setForm: (value: { name: string; subject: string; description: string; host: string; maxMembers: string; accent: string; visibility: Visibility }) => void; onClose: () => void; onSubmit: (event: FormEvent) => void; pending: boolean }) {
  return <ModalFrame onClose={onClose} eyebrow="Make a room" title="Start a study party">
    <form onSubmit={onSubmit} className="mt-7 space-y-4">
      <Field label="Party name"><input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. The Last-Minute Lab" className="form-input" data-testid="input-party-name" /></Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_110px]"><Field label="Subject"><input required minLength={2} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Biology" className="form-input" data-testid="input-party-subject" /></Field><Field label="Seats"><input required type="number" min={2} max={50} value={form.maxMembers} onChange={(event) => setForm({ ...form, maxMembers: event.target.value })} className="form-input" data-testid="input-party-seats" /></Field></div>
      <Field label="What are you working on?"><textarea required minLength={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Tell people what to bring and what success looks like." rows={3} className="form-input resize-none" data-testid="input-party-description" /></Field>
      <Field label="Your name"><input required value={form.host} onChange={(event) => setForm({ ...form, host: event.target.value })} className="form-input" data-testid="input-party-host" /></Field>
       <div><p className="mb-2 text-xs font-bold">Who can find this room?</p><div className="grid gap-2 sm:grid-cols-2">
         {([{ value: 'public', label: 'Public party', description: 'Show it on the discover board.', icon: <Globe2 size={17} /> }, { value: 'private', label: 'Private party', description: 'Only people with the room link.', icon: <Lock size={17} /> }] as const).map((option) => <button type="button" key={option.value} onClick={() => setForm({ ...form, visibility: option.value })} className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${form.visibility === option.value ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/45'}`} data-testid={`button-visibility-${option.value}`}><span className={`mt-0.5 ${form.visibility === option.value ? 'text-primary' : 'text-muted-foreground'}`}>{option.icon}</span><span><span className="block text-xs font-bold">{option.label}</span><span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">{option.description}</span></span>{form.visibility === option.value && <CheckCircle2 className="ml-auto shrink-0 text-primary" size={16} />}</button>)}
       </div></div>
      <div><p className="mb-2 text-xs font-bold">Room color</p><div className="flex gap-2">{accents.map((accent) => <button type="button" key={accent.value} onClick={() => setForm({ ...form, accent: accent.value })} className={`grid h-9 w-9 place-items-center rounded-xl transition ${form.accent === accent.value ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card' : 'hover:scale-105'}`} style={{ backgroundColor: accent.value }} data-testid={`button-accent-${accent.name.toLowerCase()}`} aria-label={`${accent.name} room color`}>{form.accent === accent.value && <Check size={15} />}</button>)}</div></div>
      <button disabled={pending} type="submit" className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-wait disabled:opacity-65" data-testid="button-submit-create-party">{pending && <Loader2 className="animate-spin" size={15} />} {pending ? 'Opening room…' : 'Open the room'}</button>
    </form>
  </ModalFrame>;
}

function JoinModal({ party, memberName, setMemberName, onClose, onSubmit, pending }: { party: Party; memberName: string; setMemberName: (value: string) => void; onClose: () => void; onSubmit: (event: FormEvent) => void; pending: boolean }) {
  return <ModalFrame onClose={onClose} eyebrow={party.subject} title={`Join ${party.name}`}><form onSubmit={onSubmit} className="mt-7"><div className="rounded-2xl bg-muted/70 p-4"><div className="flex items-center gap-3"><Avatar name={party.host} tone={party.accent} /><div><p className="text-xs font-bold">{party.host} is hosting</p><p className="mt-0.5 text-xs text-muted-foreground">{party.memberCount} of {party.maxMembers} seats filled</p></div></div><p className="mt-4 text-sm leading-relaxed text-muted-foreground">{party.description}</p></div><Field label="What should we call you?"><input required minLength={1} value={memberName} onChange={(event) => setMemberName(event.target.value)} className="form-input" data-testid="input-member-name" /></Field><button disabled={pending} type="submit" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60" data-testid="button-submit-join-party">{pending && <Loader2 className="animate-spin" size={15} />} {pending ? 'Joining room…' : 'Join the focus room'}</button></form></ModalFrame>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold">{label}</span>{children}</label>;
}

function AssistantModal({ onClose, context, initialName, onNameChange }: { onClose: () => void; context?: string; initialName: string; onNameChange: (name: string) => void }) {
  const chat = useChatWithAssistant();
  const [assistantName, setAssistantName] = useState(initialName || 'Orbit');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  useEffect(() => { onNameChange(assistantName); }, [assistantName, onNameChange]);
  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim() || chat.isPending) return;
    const current = message.trim();
    setMessages((items) => [...items, { role: 'user', text: current }]);
    setMessage('');
    chat.mutate({ data: { assistantName, message: current, context } }, { onSuccess: (response) => setMessages((items) => [...items, { role: 'assistant', text: response.reply }]) });
  };
  return <ModalFrame onClose={onClose} eyebrow="Your study sidekick" title="Ask anything, get unstuck."><div className="mt-6 rounded-2xl bg-sidebar p-4 text-sidebar-foreground"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Sparkles size={18} /></span><div><p className="text-sm font-bold">Meet <span data-testid="text-assistant-name">{assistantName}</span></p><p className="text-[11px] text-sidebar-foreground/55">Patient, practical, zero judgment.</p></div></div><div className="mt-4 flex gap-2">{['Orbit', 'Nova', 'Sage'].map((name) => <button key={name} type="button" onClick={() => setAssistantName(name)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition ${assistantName === name ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground'}`} data-testid={`button-assistant-name-${name.toLowerCase()}`}>{name}</button>)}</div></div><div className="scrollbar-thin mt-5 max-h-52 space-y-3 overflow-y-auto" data-testid="assistant-message-list">{messages.length === 0 && <div className="rounded-2xl border border-dashed border-border px-4 py-7 text-center"><Lightbulb className="mx-auto text-accent-foreground" size={21} /><p className="mt-3 text-sm font-semibold">Try: “Explain photosynthesis like I’m twelve.”</p></div>}{messages.map((item, index) => <div key={`${item.role}-${index}`} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${item.role === 'user' ? 'ml-auto rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted text-foreground'}`} data-testid={`assistant-message-${index}`}>{item.text}</div>)}{chat.isPending && <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" /><span className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:120ms]" /><span className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:240ms]" /> Thinking through it…</div>}{chat.isError && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive" data-testid="status-assistant-error">The assistant lost the thread. Try sending that again.</p>}</div><form onSubmit={send} className="mt-5 flex items-end gap-2"><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={2} maxLength={2000} placeholder={`Ask ${assistantName} a question…`} className="form-input min-h-[54px] flex-1 resize-none" data-testid="input-assistant-message" /><button disabled={!message.trim() || chat.isPending} type="submit" className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45" data-testid="button-send-assistant" aria-label="Send assistant message"><Send size={17} /></button></form></ModalFrame>;
}

function PageHeader({ eyebrow, title, description, icon }: { eyebrow: string; title: string; description: string; icon: ReactNode }) {
  return <div className="mb-7 flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">{icon}</span><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">{eyebrow}</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-.06em] sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p></div></div>;
}

function ProfilePage({ preferences, updatePreferences }: { preferences: Preferences; updatePreferences: (patch: Partial<Preferences>) => void }) {
  const [saved, setSaved] = useState(false);
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const save = (event: FormEvent) => {
    event.preventDefault();
    updatePreferences({ profileName: preferences.profileName.trim() || 'Study friend', profileBio: preferences.profileBio.trim() });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  return <div className="mx-auto max-w-[980px] px-5 py-8 sm:px-8 sm:py-10">
    <PageHeader eyebrow="Your space" title="Make it yours." description="Create a lightweight profile so your friends know who is in the room. You can update it any time." icon={<Users size={21} />} />
    {isLoaded && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/75 px-4 py-3 text-xs"><div><span className="font-bold">{user ? `Signed in as ${user.primaryEmailAddress?.emailAddress || user.fullName || 'your account'}` : 'Want your profile on every device?'}</span><span className="ml-2 text-muted-foreground">{user ? 'Your account is ready.' : 'Create a free account to keep your identity with you.'}</span></div>{user ? <button type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="rounded-lg border border-border px-3 py-2 font-bold transition hover:border-primary/45" data-testid="button-sign-out">Sign out</button> : <div className="flex gap-2"><Link href="/sign-in" className="rounded-lg border border-border px-3 py-2 font-bold transition hover:border-primary/45" data-testid="link-sign-in">Sign in</Link><Link href="/sign-up" className="rounded-lg bg-primary px-3 py-2 font-bold text-primary-foreground transition hover:-translate-y-0.5" data-testid="link-sign-up">Create account</Link></div>}</div>}
    <div className="grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
      <section className="rounded-[24px] bg-sidebar p-6 text-sidebar-foreground shadow-md sm:p-8"><p className="text-xs font-bold uppercase tracking-[.15em] text-sidebar-foreground/45">Profile preview</p><div className="mt-8 flex flex-col items-center text-center"><Avatar name={preferences.profileName || 'Study friend'} tone={preferences.profileTone} size="large" /><h2 className="mt-4 font-display text-2xl font-bold">{preferences.profileName || 'Study friend'}</h2><p className="mt-1 text-sm text-sidebar-foreground/55">{preferences.profileBio || 'Ready to focus'}</p><span className="mt-5 rounded-full bg-sidebar-accent px-3 py-1.5 text-[10px] font-bold text-sidebar-primary">Focus explorer</span></div><div className="mt-9 rounded-2xl bg-sidebar-accent/70 p-4"><p className="text-xs font-bold">No password needed</p><p className="mt-1 text-xs leading-relaxed text-sidebar-foreground/50">This profile is saved on this device for now. Account sign-in can be added later without losing your setup.</p></div></section>
      <form onSubmit={save} className="rounded-[24px] border border-border bg-card/85 p-6 shadow-xs sm:p-8"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Profile details</p><h2 className="mt-1 font-display text-xl font-bold">Your account card</h2></div><span className="rounded-full bg-secondary/45 px-2.5 py-1 text-[10px] font-bold text-secondary-foreground">Saved locally</span></div><div className="mt-7 space-y-5"><Field label="Display name"><input value={preferences.profileName} onChange={(event) => updatePreferences({ profileName: event.target.value })} maxLength={40} className="form-input" placeholder="What should friends call you?" data-testid="input-profile-name" /></Field><Field label="Short bio"><textarea value={preferences.profileBio} onChange={(event) => updatePreferences({ profileBio: event.target.value })} maxLength={80} rows={3} className="form-input resize-none" placeholder="e.g. Focus explorer · Year 10" data-testid="input-profile-bio" /></Field><div><p className="mb-2 text-xs font-bold">Profile color</p><div className="flex items-center gap-3"><div className="flex gap-2">{accents.map((accent) => <button type="button" key={accent.value} onClick={() => updatePreferences({ profileTone: accent.value })} className={`h-9 w-9 rounded-xl transition ${preferences.profileTone === accent.value ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card' : 'hover:scale-105'}`} style={{ backgroundColor: accent.value }} aria-label={`${accent.name} profile color`} />)}</div><input type="color" value={preferences.profileTone} onChange={(event) => updatePreferences({ profileTone: event.target.value })} className="h-9 w-9 cursor-pointer rounded-xl border-0 bg-transparent p-0" aria-label="Custom profile color" /></div></div></div><button type="submit" className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-md" data-testid="button-save-profile">{saved && <Check size={15} />} {saved ? 'Profile saved' : 'Save profile'}</button></form>
    </div>
  </div>;
}

function SettingsPage({ preferences, updatePreferences }: { preferences: Preferences; updatePreferences: (patch: Partial<Preferences>) => void }) {
  const [howOpen, setHowOpen] = useState(false);
  const themeOptions: { value: ThemeName; label: string; note: string; color: string }[] = [
    { value: 'citrus', label: 'Citrus Dusk', note: 'Warm, bright, original', color: '#F47C65' },
    { value: 'ocean', label: 'Ocean Study', note: 'Cool and calm', color: '#2B9FC6' },
    { value: 'lavender', label: 'Soft Lavender', note: 'Gentle and creative', color: '#8B78D6' },
  ];
  return <div className="mx-auto max-w-[980px] px-5 py-8 sm:px-8 sm:py-10">
    <PageHeader eyebrow="Your space" title="Settings that fit you." description="Tune the way Study Party looks, sounds, and helps you learn." icon={<Settings size={21} />} />
    <div className="space-y-5">
      <section className="rounded-[24px] border border-border bg-card/85 p-6 shadow-xs sm:p-8"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/12 text-primary"><PaletteIcon /></span><div><p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Appearance</p><h2 className="mt-1 font-display text-xl font-bold">Set the mood</h2></div></div><div className="mt-6 grid gap-3 md:grid-cols-3">{themeOptions.map((theme) => <button type="button" key={theme.value} onClick={() => updatePreferences({ theme: theme.value, accentColor: theme.color })} className={`relative overflow-hidden rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${preferences.theme === theme.value ? 'border-primary bg-primary/8 shadow-sm' : 'border-border bg-background hover:border-primary/45'}`} data-testid={`button-theme-${theme.value}`}><span className="mb-5 block h-2 w-16 rounded-full" style={{ backgroundColor: theme.color }} /><span className="block text-sm font-bold">{theme.label}</span><span className="mt-1 block text-xs text-muted-foreground">{theme.note}</span>{preferences.theme === theme.value && <CheckCircle2 className="absolute right-3 top-3 text-primary" size={17} />}</button>)}</div><div className="mt-6 grid gap-5 border-t border-border pt-6 md:grid-cols-2"><div><p className="text-xs font-bold">Custom accent color</p><p className="mt-1 text-xs text-muted-foreground">Use your own highlight color across buttons.</p></div><div className="flex items-center gap-3"><input type="color" value={preferences.accentColor} onChange={(event) => updatePreferences({ accentColor: event.target.value })} className="h-10 w-10 cursor-pointer rounded-xl border-0 bg-transparent p-0" aria-label="Custom accent color" /><span className="rounded-lg bg-muted px-3 py-2 font-mono text-xs">{preferences.accentColor.toUpperCase()}</span></div></div></section>
      <section className="rounded-[24px] border border-border bg-card/85 p-6 shadow-xs sm:p-8"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/70 text-accent-foreground"><Type size={17} /></span><div><p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Reading & motion</p><h2 className="mt-1 font-display text-xl font-bold">Make it comfortable</h2></div></div><div className="mt-6 grid gap-6 md:grid-cols-2"><div><p className="text-xs font-bold">Text size</p><div className="mt-3 flex gap-2">{(['small', 'medium', 'large'] as FontSize[]).map((size) => <button type="button" key={size} onClick={() => updatePreferences({ fontSize: size })} className={`rounded-xl border px-3 py-2 text-xs font-bold capitalize transition ${preferences.fontSize === size ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/45'}`} data-testid={`button-font-size-${size}`}>{size}</button>)}</div></div><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold">Reduce motion</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Use fewer animated transitions.</p></div><button type="button" role="switch" aria-checked={preferences.reduceMotion} onClick={() => updatePreferences({ reduceMotion: !preferences.reduceMotion })} className={`relative mt-1 h-6 w-11 rounded-full transition ${preferences.reduceMotion ? 'bg-primary' : 'bg-muted'}`} data-testid="button-reduce-motion"><span className={`absolute top-1 h-4 w-4 rounded-full bg-card transition ${preferences.reduceMotion ? 'left-6' : 'left-1'}`} /></button></div></div></section>
      <section className="rounded-[24px] border border-border bg-card/85 p-6 shadow-xs sm:p-8"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary/60 text-secondary-foreground"><Sparkles size={17} /></span><div><p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Assistant</p><h2 className="mt-1 font-display text-xl font-bold">Choose your study sidekick</h2></div></div><div className="mt-6 grid gap-4 sm:grid-cols-[1fr_1.2fr]"><div className="flex flex-wrap gap-2">{['Orbit', 'Nova', 'Sage', 'Echo'].map((name) => <button type="button" key={name} onClick={() => updatePreferences({ assistantName: name })} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${preferences.assistantName === name ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/45'}`} data-testid={`button-settings-assistant-${name.toLowerCase()}`}>{name}</button>)}</div><input value={preferences.assistantName} onChange={(event) => updatePreferences({ assistantName: event.target.value.slice(0, 40) })} maxLength={40} className="form-input" placeholder="Or type a custom name" data-testid="input-settings-assistant-name" /></div></section>
      <section className="overflow-hidden rounded-[24px] border border-border bg-card/85 shadow-xs"><button type="button" onClick={() => setHowOpen(!howOpen)} className="flex w-full items-center justify-between p-6 text-left sm:p-8" data-testid="button-how-study-party-works"><span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-foreground"><BookOpen size={17} /></span><span><span className="block text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Good to know</span><span className="mt-1 block font-display text-xl font-bold">How Study Party works</span></span></span><ChevronRight size={18} className={`text-muted-foreground transition ${howOpen ? 'rotate-90' : ''}`} /></button>{howOpen && <div className="grid gap-4 border-t border-border bg-muted/35 px-6 pb-7 pt-6 sm:grid-cols-3 sm:px-8">{[['01', 'Find a room', 'Search by subject and join a public party that matches your goal.'], ['02', 'Make a plan', 'Start a focus sprint, chat with the room, and keep each other moving.'], ['03', 'Ask for help', 'Open your named assistant whenever a concept feels stuck.']].map(([number, title, text]) => <div key={number}><span className="font-mono text-xs font-bold text-primary">{number}</span><p className="mt-2 text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p></div>)}</div>}</section>
    </div>
  </div>;
}

function AboutPage() {
  return <div className="mx-auto max-w-[980px] px-5 py-8 sm:px-8 sm:py-10"><PageHeader eyebrow="Your space" title="About Study Party." description="A calmer corner of the internet for getting schoolwork done together." icon={<Info size={21} />} /><section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><div className="rounded-[24px] bg-sidebar p-7 text-sidebar-foreground shadow-md sm:p-9"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground"><Zap size={22} /></span><h2 className="mt-7 max-w-md font-display text-3xl font-bold leading-tight tracking-[-.06em]">Less pressure.<br /><span className="text-sidebar-primary">More progress.</span></h2><p className="mt-5 max-w-md text-sm leading-relaxed text-sidebar-foreground/60">Study Party turns solo study into a small, friendly ritual. Find a room, set a goal, and let the quiet momentum of other learners carry you forward.</p><div className="mt-8 flex flex-wrap gap-2">{['Focus together', 'Ask without judgment', 'Make progress visible'].map((item) => <span key={item} className="rounded-full bg-sidebar-accent px-3 py-1.5 text-[10px] font-bold text-sidebar-foreground/70">{item}</span>)}</div></div><div className="space-y-5"><div className="rounded-[24px] border border-border bg-card/85 p-6 shadow-xs"><div className="flex items-center gap-3"><CheckCircle2 className="text-secondary-foreground" size={20} /><h2 className="font-display text-xl font-bold">Built for students</h2></div><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Public rooms make it easy to find study buddies. Private rooms let you share a direct link with your own group.</p></div><div className="rounded-[24px] border border-border bg-card/85 p-6 shadow-xs"><div className="flex items-center gap-3"><SlidersHorizontal className="text-primary" size={20} /><h2 className="font-display text-xl font-bold">Your settings matter</h2></div><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Choose your colors, text size, motion preferences, profile, and assistant name from Settings.</p></div><Link href="/settings" className="flex items-center justify-between rounded-[24px] border border-primary/20 bg-primary/8 p-6 text-sm font-bold transition hover:-translate-y-0.5"><span>Customize your space</span><ArrowUpRight size={17} /></Link></div></section></div>;
}

function PaletteIcon() {
  return <span className="block h-[17px] w-[17px] rounded-full border-[3px] border-current border-r-transparent rotate-[-35deg]" />;
}

function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return <div className="mx-auto max-w-[760px] px-5 py-10 sm:px-8"><PageHeader eyebrow="Legal" title={title} description={`Last updated ${updated}`} icon={<Info size={21} />} /><div className="mt-6 space-y-6 rounded-[24px] border border-border bg-card/85 p-7 text-sm leading-relaxed text-muted-foreground shadow-xs sm:p-9">{children}</div></div>;
}

function PrivacyPolicyPage() {
  return <LegalPage title="Privacy Policy" updated="[add date when you publish]">
    <p><strong className="text-foreground">Placeholder notice:</strong> this is a starting template, not a finished legal document. Fill in the bracketed parts below with your real details, and have someone review it before you rely on it — this is not legal advice.</p>
    <section><h2 className="font-display text-lg font-bold text-foreground">What we collect</h2><p className="mt-2">When you use Study Party, we collect the display name you choose, messages you send in study parties, and basic technical data (like connection info) needed to run live video and chat. If you sign in, our authentication provider (Clerk) also processes your account details.</p></section>
    <section><h2 className="font-display text-lg font-bold text-foreground">How we use it</h2><p className="mt-2">We use this data only to run the app: showing messages to people in the same study party, connecting video/audio between participants, and providing the study assistant's replies.</p></section>
    <section><h2 className="font-display text-lg font-bold text-foreground">Third parties</h2><p className="mt-2">We use [OpenAI] to power the study assistant and [Clerk] for sign-in. Messages you send to the assistant are shared with that provider to generate a reply.</p></section>
    <section><h2 className="font-display text-lg font-bold text-foreground">Your choices</h2><p className="mt-2">You can delete your own messages from a study party at any time. To request full account deletion or ask what data we hold, contact us at [your contact email].</p></section>
    <section><h2 className="font-display text-lg font-bold text-foreground">Contact</h2><p className="mt-2">[Your name / business name]<br />[Contact email]<br />[Jurisdiction, if relevant]</p></section>
  </LegalPage>;
}

function TermsPage() {
  return <LegalPage title="Terms & Conditions" updated="[add date when you publish]">
    <p><strong className="text-foreground">Placeholder notice:</strong> this is a starting template, not a finished legal document. Fill in the bracketed parts and have it reviewed before you rely on it — this is not legal advice.</p>
    <section><h2 className="font-display text-lg font-bold text-foreground">Using Study Party</h2><p className="mt-2">By using this app you agree to treat other members respectfully. Messages containing profanity may trigger a short, automatic cooldown before you can post again.</p></section>
    <section><h2 className="font-display text-lg font-bold text-foreground">Content</h2><p className="mt-2">You're responsible for what you post. Anyone can delete a message they sent; hosts of "premium" study parties can view messages after they're deleted, for moderation purposes.</p></section>
    <section><h2 className="font-display text-lg font-bold text-foreground">No guarantees</h2><p className="mt-2">Study Party is provided "as is," with no uptime or accuracy guarantees, including for the AI study assistant's replies.</p></section>
    <section><h2 className="font-display text-lg font-bold text-foreground">Changes</h2><p className="mt-2">We may update these terms; continuing to use the app after a change means you accept the update.</p></section>
    <section><h2 className="font-display text-lg font-bold text-foreground">Contact</h2><p className="mt-2">[Your name / business name]<br />[Contact email]</p></section>
  </LegalPage>;
}

function SearchModal({ onClose }: { onClose: () => void }) {
  const partiesQuery = useListParties();
  const [query, setQuery] = useState('');
  const parties = partiesQuery.data ?? [];
  const results = useMemo(() => parties.filter((party) => `${party.name} ${party.subject} ${party.description} ${party.host}`.toLowerCase().includes(query.toLowerCase().trim())), [parties, query]);
  return <ModalFrame onClose={onClose} eyebrow="Find your focus" title="Search study parties"><div className="relative mt-6"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="form-input pl-10" placeholder="Try “math”, “exam prep”, or a host name" data-testid="input-global-search" /></div><div className="mt-5 max-h-[360px] space-y-2 overflow-y-auto">{partiesQuery.isLoading && <div className="rounded-xl bg-muted p-4 text-xs text-muted-foreground">Looking across the public board…</div>}{!partiesQuery.isLoading && !results.length && <div className="rounded-xl border border-dashed border-border p-7 text-center"><Search className="mx-auto text-muted-foreground" size={20} /><p className="mt-3 text-sm font-bold">{query ? 'No parties match that search.' : 'No public parties yet.'}</p><p className="mt-1 text-xs text-muted-foreground">Try a different subject or start your own room.</p></div>}{results.map((party) => <Link href={`/party/${party.id}`} onClick={onClose} key={party.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition hover:border-primary/45 hover:bg-primary/5" data-testid={`search-result-${party.id}`}><span className="h-9 w-1 rounded-full" style={{ backgroundColor: party.accent }} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{party.name}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{party.subject} · {party.memberCount}/{party.maxMembers} studying · hosted by {party.host}</p></div><ArrowUpRight size={15} className="text-muted-foreground" /></Link>)}</div></ModalFrame>;
}

function Participant({ name, tone, status }: { name: string; tone: string; status: string }) {
  return <div className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-muted/60" data-testid={`participant-${name.replace(/\s+/g, '-').toLowerCase()}`}><Avatar name={name} tone={tone} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{name}</p><p className="truncate text-[10px] text-muted-foreground">{status}</p></div><span className="h-1.5 w-1.5 rounded-full bg-secondary-foreground" /></div>;
}

type LiveParticipant = {
  id: string;
  name: string;
  tone: string;
  micEnabled: boolean;
  videoEnabled: boolean;
  stream: MediaStream | null;
};

type LiveRoomStatus = 'unsupported' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'offline';

type SignalingParticipant = Omit<LiveParticipant, 'stream'>;

function getPresenceId() {
  const storageKey = 'study-party-presence-id';
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;
    const next = window.crypto.randomUUID();
    window.localStorage.setItem(storageKey, next);
    return next;
  } catch {
    return window.crypto.randomUUID();
  }
}

function useLiveRoom({ partyId, displayName, tone, inRoom, localStream, micOn, videoOn, onPresenceChange }: {
  partyId: number;
  displayName: string;
  tone: string;
  inRoom: boolean;
  localStream: MediaStream | null;
  micOn: boolean;
  videoOn: boolean;
  onPresenceChange?: (memberCount?: number) => void;
}) {
  const [remoteParticipants, setRemoteParticipants] = useState<LiveParticipant[]>([]);
  const [status, setStatus] = useState<LiveRoomStatus>('offline');
  const socketRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const participantRef = useRef(new Map<string, SignalingParticipant>());
  const pendingCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const localParticipantIdRef = useRef('');
  const localStreamRef = useRef<MediaStream | null>(localStream);
  const identityRef = useRef({ displayName, tone, micOn, videoOn });
  const reconnectTimerRef = useRef<number | undefined>(undefined);
  const reconnectAttemptRef = useRef(0);
  const manualCloseRef = useRef(false);
  const presenceIdRef = useRef('');
  const presenceChangeRef = useRef(onPresenceChange);

  useEffect(() => {
    presenceChangeRef.current = onPresenceChange;
  }, [onPresenceChange]);

  useEffect(() => {
    localStreamRef.current = localStream;
    identityRef.current = { displayName, tone, micOn, videoOn };
  }, [displayName, tone, micOn, videoOn, localStream]);

  useEffect(() => {
    if (!inRoom) {
      setStatus('offline');
      return;
    }
    if (typeof window.RTCPeerConnection === 'undefined' || typeof window.WebSocket === 'undefined') {
      setStatus('unsupported');
      return;
    }

    manualCloseRef.current = false;
    let disposed = false;

    const closePeer = (participantId: string) => {
      peerConnectionsRef.current.get(participantId)?.close();
      peerConnectionsRef.current.delete(participantId);
      participantRef.current.delete(participantId);
      pendingCandidatesRef.current.delete(participantId);
      setRemoteParticipants((items) => items.filter((item) => item.id !== participantId));
    };

    const closeAllPeers = () => {
      for (const connection of peerConnectionsRef.current.values()) connection.close();
      peerConnectionsRef.current.clear();
      participantRef.current.clear();
      pendingCandidatesRef.current.clear();
      setRemoteParticipants([]);
    };

    const send = (message: unknown) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(message));
        return true;
      }
      return false;
    };

    const upsertParticipant = (participant: SignalingParticipant, stream?: MediaStream | null) => {
      participantRef.current.set(participant.id, participant);
      setRemoteParticipants((items) => {
        const existing = items.find((item) => item.id === participant.id);
        const next = { ...participant, stream: stream === undefined ? existing?.stream ?? null : stream };
        return existing ? items.map((item) => item.id === participant.id ? next : item) : [...items, next];
      });
    };

    const updateParticipant = (participant: SignalingParticipant) => {
      const current = participantRef.current.get(participant.id);
      upsertParticipant(participant, current ? undefined : null);
    };

    const flushCandidates = async (participantId: string, connection: RTCPeerConnection) => {
      const candidates = pendingCandidatesRef.current.get(participantId) ?? [];
      pendingCandidatesRef.current.delete(participantId);
      await Promise.all(candidates.map((candidate) => connection.addIceCandidate(candidate).catch(() => undefined)));
    };

    const createPeer = (participant: SignalingParticipant, initiator: boolean) => {
      const existing = peerConnectionsRef.current.get(participant.id);
      if (existing) return existing;

      const connection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      peerConnectionsRef.current.set(participant.id, connection);
      upsertParticipant(participant);

      for (const track of localStreamRef.current?.getTracks() ?? []) {
        connection.addTrack(track, localStreamRef.current as MediaStream);
      }
      connection.onicecandidate = (event) => {
        if (event.candidate) send({ type: 'signal', targetId: participant.id, signal: event.candidate.toJSON() });
      };
      connection.ontrack = (event) => {
        const stream = event.streams[0] ?? null;
        upsertParticipant(participantRef.current.get(participant.id) ?? participant, stream);
      };
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === 'failed' || connection.connectionState === 'closed') {
          closePeer(participant.id);
        }
      };

      if (initiator) {
        void connection.createOffer()
          .then((offer) => connection.setLocalDescription(offer))
          .then(() => {
            if (connection.localDescription) {
              send({ type: 'signal', targetId: participant.id, signal: connection.localDescription });
            }
          })
          .catch(() => closePeer(participant.id));
      }
      return connection;
    };

    const handleSignal = async (fromId: string, signal: unknown) => {
      if (!signal || typeof signal !== 'object' || !('type' in signal)) return;
      const participant = participantRef.current.get(fromId);
      if (!participant) return;
      const connection = createPeer(participant, false);
      const signalType = signal.type;

      if (signalType === 'offer' || signalType === 'answer') {
        await connection.setRemoteDescription(signal as RTCSessionDescriptionInit);
        await flushCandidates(fromId, connection);
        if (signalType === 'offer') {
          const answer = await connection.createAnswer();
          await connection.setLocalDescription(answer);
          if (connection.localDescription) {
            send({ type: 'signal', targetId: fromId, signal: connection.localDescription });
          }
        }
      } else if (signalType === 'candidate') {
        const candidate = signal as RTCIceCandidateInit;
        if (connection.remoteDescription) {
          await connection.addIceCandidate(candidate).catch(() => undefined);
        } else {
          pendingCandidatesRef.current.set(fromId, [...(pendingCandidatesRef.current.get(fromId) ?? []), candidate]);
        }
      }
    };

    const connect = () => {
      if (disposed || manualCloseRef.current) return;
      setStatus(reconnectAttemptRef.current ? 'reconnecting' : 'connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      socketRef.current = socket;
      socket.onopen = () => {
        reconnectAttemptRef.current = 0;
        setStatus('connected');
        const identity = identityRef.current;
        send({
          type: 'join',
          partyId,
          presenceId: presenceIdRef.current || (presenceIdRef.current = getPresenceId()),
          name: identity.displayName,
          tone: identity.tone,
          micEnabled: identity.micOn,
          videoEnabled: identity.videoOn,
        });
      };
      socket.onmessage = (event) => {
        let message: { type?: string; [key: string]: unknown };
        try {
          message = JSON.parse(event.data) as { type?: string; [key: string]: unknown };
        } catch {
          return;
        }
        if (message.type === 'room-state' && typeof message.participantId === 'string' && Array.isArray(message.participants)) {
          localParticipantIdRef.current = message.participantId;
          for (const item of message.participants) {
            if (item && typeof item === 'object' && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.tone === 'string' && typeof item.micEnabled === 'boolean' && typeof item.videoEnabled === 'boolean') {
              const participant = item as unknown as SignalingParticipant;
              createPeer(participant, true);
            }
          }
        } else if (message.type === 'participant-joined' && message.participant && typeof message.participant === 'object') {
          const item = message.participant as Record<string, unknown>;
          if (typeof item.id === 'string' && typeof item.name === 'string' && typeof item.tone === 'string' && typeof item.micEnabled === 'boolean' && typeof item.videoEnabled === 'boolean') {
            upsertParticipant(item as unknown as SignalingParticipant);
          }
        } else if (message.type === 'participant-updated' && message.participant && typeof message.participant === 'object') {
          const item = message.participant as Record<string, unknown>;
          if (typeof item.id === 'string' && typeof item.name === 'string' && typeof item.tone === 'string' && typeof item.micEnabled === 'boolean' && typeof item.videoEnabled === 'boolean') {
            updateParticipant(item as unknown as SignalingParticipant);
          }
        } else if (message.type === 'participant-left' && typeof message.participantId === 'string') {
          closePeer(message.participantId);
        } else if (message.type === 'presence-updated' && typeof message.memberCount === 'number' && Number.isSafeInteger(message.memberCount) && message.memberCount >= 0) {
          presenceChangeRef.current?.(message.memberCount);
        } else if (message.type === 'signal' && typeof message.fromId === 'string') {
          void handleSignal(message.fromId, message.signal).catch(() => closePeer(message.fromId as string));
        } else if (message.type === 'error') {
          setStatus('error');
        }
      };
      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
        closeAllPeers();
        if (!disposed && !manualCloseRef.current) {
          reconnectAttemptRef.current += 1;
          const delay = Math.min(1000 * 2 ** Math.min(reconnectAttemptRef.current - 1, 4), 15000);
          reconnectTimerRef.current = window.setTimeout(connect, delay);
          setStatus('reconnecting');
        }
      };
      socket.onerror = () => setStatus('error');
    };

    connect();
    return () => {
      disposed = true;
      manualCloseRef.current = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
      socketRef.current = null;
      closeAllPeers();
      presenceChangeRef.current?.();
    };
  }, [partyId, inRoom]);

  useEffect(() => {
    if (!inRoom) return;
    const stream = localStreamRef.current;
    for (const [participantId, connection] of peerConnectionsRef.current) {
      let addedTrack = false;
      for (const kind of ['audio', 'video'] as const) {
        const track = stream?.getTracks().find((item) => item.kind === kind) ?? null;
        const sender = connection.getSenders().find((item) => item.track?.kind === kind);
        if (sender) {
          void sender.replaceTrack(track);
        } else if (track && stream) {
          connection.addTrack(track, stream);
          addedTrack = true;
        }
      }
      if (addedTrack && socketRef.current?.readyState === WebSocket.OPEN) {
        void connection.createOffer()
          .then((offer) => connection.setLocalDescription(offer))
          .then(() => {
            if (connection.localDescription) {
              socketRef.current?.send(JSON.stringify({ type: 'signal', targetId: participantId, signal: connection.localDescription }));
            }
          })
          .catch(() => undefined);
      }
    }
  }, [inRoom, localStream]);

  useEffect(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN && localParticipantIdRef.current) {
      socketRef.current.send(JSON.stringify({ type: 'media-state', micEnabled: micOn, videoEnabled: videoOn }));
    }
  }, [micOn, videoOn]);

  return { remoteParticipants, status };
}

function RemoteVideoTile({ participant }: { participant: LiveParticipant }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = participant.stream;
  }, [participant.stream]);
  const showVideo = participant.videoEnabled && Boolean(participant.stream?.getVideoTracks().length);
  return <div className="relative min-h-[126px] overflow-hidden rounded-2xl bg-sidebar" data-testid={`remote-video-${participant.id}`}>
    {showVideo ? <video ref={videoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" aria-label={`${participant.name}'s camera`} /> : <div className="absolute inset-0 grid place-items-center"><Avatar name={participant.name} tone={participant.tone} size="large" /></div>}
    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-6 text-[10px] font-bold text-white">
      <span className="truncate">{participant.name}</span>
      {participant.micEnabled ? <Mic size={12} /> : <MicOff size={12} className="text-red-200" />}
    </div>
  </div>;
}

function describeMediaError(error: unknown, device: 'microphone' | 'camera') {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return `Allow ${device} access in your browser's site settings to use it here.`;
  }
  if (name === 'NotFoundError') {
    return `No ${device} was found on this device.`;
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return `The ${device} is already in use by another app or browser tab. Close it there and try again.`;
  }
  return `We could not start the ${device}. Check that it isn't in use elsewhere and try again.`;
}

function getOrCreateClientId(): string {
  const key = 'study-party-client-id';
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    // localStorage unavailable (private browsing, etc.) — mute cooldown just won't persist across reloads.
    return crypto.randomUUID();
  }
}

function getStoredDeleteToken(messageId: number): string | null {
  try {
    return window.localStorage.getItem(`study-party-delete-token:${messageId}`);
  } catch {
    return null;
  }
}

function storeDeleteToken(messageId: number, token: string): void {
  try {
    window.localStorage.setItem(`study-party-delete-token:${messageId}`, token);
  } catch {
    // ignore
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null }> {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
  const response = await fetch(`${base}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : null;
  return { ok: response.ok, status: response.status, data };
}

function PartyRoomPage({ onAssistant }: { onAssistant: (context?: string) => void }) {
  const { id } = useParams<{ id: string }>();
  const partyId = Number(id);
  const partyQuery = useGetParty(partyId, { query: { queryKey: getGetPartyQueryKey(partyId) } });
  const messagesQuery = useListPartyMessages(partyId, { query: { queryKey: getListPartyMessagesQueryKey(partyId) } });
  const createMessage = useCreatePartyMessage();
  const joinParty = useJoinParty();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const party = partyQuery.data;
  const [message, setMessage] = useState('');
  const [displayName, setDisplayName] = useState('Alex Morgan');
  const [micOn, setMicOn] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inRoom, setInRoom] = useState(true);
  const [joinOpen, setJoinOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'people'>('chat');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(25 * 60);
  const [clientId] = useState(getOrCreateClientId);
  const [mutedUntil, setMutedUntil] = useState<number | null>(null);
  const [mutedSecondsLeft, setMutedSecondsLeft] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedMessages, setDeletedMessages] = useState<PartyMessage[]>([]);
  const [premiumBusy, setPremiumBusy] = useState(false);
  const refreshPresence = useCallback((memberCount?: number) => {
    if (typeof memberCount === 'number') {
      queryClient.setQueryData<Party>(getGetPartyQueryKey(partyId), (current) => current ? { ...current, memberCount } : current);
    }
    queryClient.invalidateQueries({ queryKey: getGetPartyQueryKey(partyId) });
    queryClient.invalidateQueries({ queryKey: getListPartiesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  }, [partyId, queryClient]);
  const liveRoom = useLiveRoom({
    partyId,
    displayName,
    tone: party?.accent || '#F47C65',
    inRoom,
    localStream: mediaStream,
    micOn,
    videoOn,
    onPresenceChange: refreshPresence,
  });
  const messages = messagesQuery.data ?? [];
  useEffect(() => {
    if (!sessionStarted) {
      setSessionSeconds(25 * 60);
      return;
    }
    const timer = window.setInterval(() => {
      setSessionSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionStarted]);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = mediaStream;
  }, [mediaStream]);
  useEffect(() => {
    if (!mutedUntil) return;
    const tick = () => setMutedSecondsLeft(Math.max(0, Math.ceil((mutedUntil - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [mutedUntil]);
  useEffect(() => {
    if (mutedUntil && mutedSecondsLeft <= 0) setMutedUntil(null);
  }, [mutedSecondsLeft, mutedUntil]);
  const stopMedia = useCallback(() => {
    mediaStream?.getTracks().forEach((track) => track.stop());
    setMediaStream(null);
    setMicOn(false);
    setVideoOn(false);
  }, [mediaStream]);
  useEffect(() => () => {
    mediaStream?.getTracks().forEach((track) => track.stop());
  }, [mediaStream]);
  const updateMedia = async (nextMic: boolean, nextVideo: boolean) => {
    setMediaError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError('Camera and microphone access is not supported in this browser.');
      return;
    }

    let stream = mediaStream;
    const hasAudio = Boolean(stream?.getAudioTracks().length);
    const hasVideo = Boolean(stream?.getVideoTracks().length);
    const errors: string[] = [];
    let actualMic = nextMic;
    let actualVideo = nextVideo;

    // Request audio and video as SEPARATE getUserMedia calls. Previously these were
    // requested together, so a blocked/unavailable camera made the mic fail too.
    if (nextMic && !hasAudio) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const [audioTrack] = audioStream.getAudioTracks();
        if (audioTrack) {
          if (!stream) {
            stream = audioStream;
          } else {
            stream.addTrack(audioTrack);
          }
        }
      } catch (error) {
        actualMic = false;
        errors.push(describeMediaError(error, 'microphone'));
      }
    }

    if (nextVideo && !hasVideo) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const [videoTrack] = videoStream.getVideoTracks();
        if (videoTrack) {
          if (!stream) {
            stream = videoStream;
          } else {
            stream.addTrack(videoTrack);
          }
        }
      } catch (error) {
        actualVideo = false;
        errors.push(describeMediaError(error, 'camera'));
      }
    }

    if (stream && stream !== mediaStream) {
      setMediaStream(stream);
    }
    stream?.getAudioTracks().forEach((track) => { track.enabled = actualMic; });
    stream?.getVideoTracks().forEach((track) => { track.enabled = actualVideo; });
    setMicOn(actualMic);
    setVideoOn(actualVideo);
    if (errors.length) setMediaError(errors.join(' '));
  };
  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim() || createMessage.isPending || mutedUntil) return;
    createMessage.mutate(
      { partyId, data: { sender: displayName, content: message.trim(), clientId } },
      {
        onSuccess: (sent) => {
          setMessage('');
          if (sent && typeof sent === 'object' && 'id' in sent && 'deleteToken' in sent && sent.deleteToken) {
            storeDeleteToken((sent as PartyMessage).id, (sent as PartyMessage & { deleteToken: string }).deleteToken);
          }
          queryClient.invalidateQueries({ queryKey: getListPartyMessagesQueryKey(partyId) });
        },
        onError: (error) => {
          const apiError = error as { status?: number; data?: { retryAfterSeconds?: number } };
          if (apiError?.status === 429) {
            const retryAfter = apiError.data?.retryAfterSeconds ?? 60;
            setMutedUntil(Date.now() + retryAfter * 1000);
          }
        },
      },
    );
  };
  const deleteMessage = async (item: PartyMessage) => {
    const token = getStoredDeleteToken(item.id);
    if (!token) return;
    const result = await apiFetch(`/parties/${partyId}/messages/${item.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ deleteToken: token }),
    });
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: getListPartyMessagesQueryKey(partyId) });
    }
  };
  const loadDeletedMessages = async () => {
    const result = await apiFetch<PartyMessage[]>(`/parties/${partyId}/messages/deleted`);
    if (result.ok && result.data) setDeletedMessages(result.data);
    setShowDeleted(true);
  };
  const togglePremium = async () => {
    if (!party) return;
    setPremiumBusy(true);
    const result = await apiFetch<{ id: number; isPremium: boolean }>(`/parties/${partyId}/premium`, {
      method: 'POST',
      body: JSON.stringify({ host: party.host, isPremium: !party.isPremium }),
    });
    setPremiumBusy(false);
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: getGetPartyQueryKey(partyId) });
    }
  };
  const join = (event: FormEvent) => {
    event.preventDefault();
    joinParty.mutate({ partyId, data: { memberName: displayName } }, { onSuccess: () => { setInRoom(true); setJoinOpen(false); queryClient.invalidateQueries({ queryKey: getGetPartyQueryKey(partyId) }); queryClient.invalidateQueries({ queryKey: getListPartyMessagesQueryKey(partyId) }); } });
  };
  if (partyQuery.isLoading) return <div className="mx-auto max-w-[1200px] px-5 py-10"><div className="h-8 w-48 animate-pulse rounded-lg bg-muted" /><div className="mt-6 h-56 animate-pulse rounded-[28px] bg-card" /></div>;
  if (partyQuery.isError || !party) return <div className="mx-auto max-w-lg px-5 py-24 text-center" data-testid="status-party-error"><CircleHelp className="mx-auto text-destructive" size={30} /><h1 className="mt-4 font-display text-2xl font-bold">This room is out of reach.</h1><p className="mt-2 text-sm text-muted-foreground">It may have closed or the link may be off.</p><Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground" data-testid="link-back-dashboard"><ArrowLeft size={15} /> Back to party board</Link></div>;
  const palette = party.accent || '#F47C65';
  return <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-10">
    <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition hover:text-foreground" data-testid="link-back-to-parties"><ArrowLeft size={15} /> All parties</Link>
    <section className="relative overflow-hidden rounded-[28px] bg-sidebar p-6 text-sidebar-foreground shadow-md sm:p-8">
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[38px] opacity-35" style={{ borderColor: palette }} /><div className="absolute bottom-0 right-[28%] h-24 w-24 rounded-full blur-2xl" style={{ backgroundColor: `${palette}45` }} />
      <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end"><div><div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em]"><span className="rounded-md px-2 py-1" style={{ backgroundColor: `${palette}2e`, color: palette }}>{party.subject}</span>{party.isLive && <span className="flex items-center gap-1.5 text-sidebar-primary"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sidebar-primary" /> Live session</span>}</div><h1 className="mt-5 max-w-2xl font-display text-[clamp(2.2rem,5vw,4.5rem)] font-bold leading-[.94] tracking-[-.075em]">{party.name}</h1><p className="mt-5 max-w-xl text-sm leading-relaxed text-sidebar-foreground/60 sm:text-base">{party.description}</p><div className="mt-6 flex items-center gap-3"><Avatar name={party.host} tone={palette} /><div><p className="text-xs font-bold">{party.host}</p><p className="text-[10px] text-sidebar-foreground/45">Host · opened {timeAgo(party.createdAt)}</p></div></div></div><div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end"><div className="flex items-center gap-2 rounded-xl border border-sidebar-foreground/10 bg-sidebar-accent/70 px-3 py-2 text-xs font-semibold"><Users size={15} className="text-sidebar-primary" /> {party.memberCount} / {party.maxMembers} studying</div>{inRoom ? <button onClick={() => setSessionStarted(!sessionStarted)} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition hover:-translate-y-0.5 hover:shadow-lg ${sessionStarted ? 'bg-sidebar-accent text-sidebar-foreground' : 'bg-sidebar-primary text-sidebar-primary-foreground'}`} data-testid="button-start-focus-session">{sessionStarted ? <><Timer size={15} /> Session in progress</> : <><PlayIcon /> Start a focus session</>}</button> : <button onClick={() => setJoinOpen(true)} className="rounded-xl bg-sidebar-primary px-4 py-3 text-xs font-bold text-sidebar-primary-foreground" data-testid="button-join-room-header">Join this room</button>}</div></div>
    </section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
      <div className="min-h-[530px] rounded-[24px] border border-border bg-card/90 shadow-xs">
        <div className="flex items-center justify-between border-b border-border px-5 py-4"><div className="flex items-center gap-1 rounded-xl bg-muted p-1"><button onClick={() => setActiveTab('chat')} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === 'chat' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`} data-testid="button-tab-chat"><MessageCircle size={14} /> Party chat</button><button onClick={() => setActiveTab('people')} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === 'people' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`} data-testid="button-tab-people"><Users size={14} /> People</button></div><span className="flex items-center gap-1.5 text-[10px] font-bold text-secondary-foreground"><span className="h-1.5 w-1.5 rounded-full bg-secondary-foreground" /> Room is open</span></div>
        {activeTab === 'chat' ? <><div className="scrollbar-thin flex min-h-[375px] max-h-[480px] flex-col gap-4 overflow-y-auto p-5" data-testid="party-message-list">{messagesQuery.isLoading && <><MessageSkeleton /><MessageSkeleton /><MessageSkeleton /></>}{!messagesQuery.isLoading && messages.length === 0 && <div className="m-auto max-w-xs text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary/45 text-secondary-foreground"><MessageCircle size={21} /></span><p className="mt-4 text-sm font-bold">The room is quiet for now.</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Say hi, share your goal, or drop a helpful link.</p></div>}{messages.map((item) => <ChatBubble key={item.id} item={item} mine={item.sender === displayName} canDelete={item.sender === displayName && Boolean(getStoredDeleteToken(item.id))} onDelete={() => deleteMessage(item)} />)}{showDeleted && deletedMessages.length > 0 && <div className="mt-2 rounded-xl border border-dashed border-border p-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">Deleted messages (premium)</p>{deletedMessages.map((item) => <ChatBubble key={item.id} item={item} mine={false} deleted /> )}</div>}</div>{mutedUntil ? <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-center text-xs font-bold text-destructive" data-testid="status-muted">You're muted for language. You can send messages again in {mutedSecondsLeft}s.</div> : null}<form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-border p-4"><Avatar name={displayName} tone={palette} /><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={1} placeholder={mutedUntil ? 'You are muted right now…' : 'Message the room…'} disabled={Boolean(mutedUntil)} className="form-input min-h-[42px] flex-1 resize-none disabled:opacity-50" data-testid="input-party-message" /><button type="submit" disabled={!message.trim() || createMessage.isPending || Boolean(mutedUntil)} className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:-translate-y-0.5 disabled:opacity-45" data-testid="button-send-party-message" aria-label="Send party message">{createMessage.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button></form>{party.host === displayName && <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Host controls</span><div className="flex items-center gap-2"><button onClick={togglePremium} disabled={premiumBusy} className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition hover:border-primary disabled:opacity-50" data-testid="button-toggle-premium">{party.isPremium ? 'Premium: On' : 'Premium: Off'}</button>{party.isPremium && <button onClick={loadDeletedMessages} className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition hover:border-primary" data-testid="button-view-deleted">View deleted</button>}</div></div>}</> : <div className="grid min-h-[470px] content-start gap-2 p-5 sm:grid-cols-2"><Participant name={party.host} tone={palette} status="Hosting this room" /><Participant name="Alex Morgan" tone="#F2C94C" status="Working quietly" /><Participant name="Maya Chen" tone="#4DB6A5" status="On a 25 min sprint" /><Participant name="Theo Williams" tone="#8075D6" status="Reviewing notes" /></div>}
      </div>
      <aside className="space-y-5">
       <div className="rounded-[24px] border border-border bg-card/90 p-5 shadow-xs"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">Study controls</p><h2 className="mt-1 font-display text-xl font-bold tracking-[-.04em]">Shared room</h2></div><span className={`grid h-9 w-9 place-items-center rounded-xl ${sessionStarted ? 'bg-secondary/50 text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}><Headphones size={17} /></span></div>{videoOn && <div className="relative mt-5 overflow-hidden rounded-2xl bg-sidebar"><video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" aria-label="Your camera preview" /><span className="absolute bottom-2 left-2 rounded-lg bg-black/55 px-2 py-1 text-[10px] font-bold text-white">You</span></div>}<div className={`${videoOn ? 'mt-3' : 'mt-5'} rounded-2xl bg-sidebar p-4 text-center text-sidebar-foreground`}>{sessionStarted ? <><span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-sidebar-primary/30 bg-sidebar-primary/15 text-sidebar-primary animate-pulse-ring"><Timer size={20} /></span><p className="mt-3 font-display text-2xl font-bold">{`${Math.floor(sessionSeconds / 60).toString().padStart(2, '0')}:${(sessionSeconds % 60).toString().padStart(2, '0')}`}</p><p className="text-[10px] font-bold uppercase tracking-[.15em] text-sidebar-foreground/45">{sessionSeconds ? 'focus sprint' : 'sprint complete'}</p></> : <><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-sidebar-accent text-sidebar-primary"><Clock3 size={20} /></span><p className="mt-3 text-sm font-bold">Ready when you are</p><p className="mt-1 text-[11px] text-sidebar-foreground/45">Start a shared 25-minute sprint.</p></>}</div><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => void updateMedia(!micOn, videoOn)} className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition ${micOn ? 'border-border bg-background' : 'border-destructive/20 bg-destructive/5 text-destructive'}`} data-testid="button-toggle-mic">{micOn ? <Mic size={15} /> : <MicOff size={15} />}{micOn ? 'Mic on' : 'Mic off'}</button><button onClick={() => void updateMedia(micOn, !videoOn)} className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition ${videoOn ? 'border-border bg-background' : 'border-border bg-background text-muted-foreground'}`} data-testid="button-toggle-video">{videoOn ? <Video size={15} /> : <VideoOff size={15} />}{videoOn ? 'Camera on' : 'Camera off'}</button></div>{mediaError && <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-[11px] font-semibold leading-relaxed text-destructive" role="alert" data-testid="status-media-error">{mediaError}</p>}<div className="mt-3 rounded-xl bg-muted/70 px-3 py-2 text-[11px] font-semibold text-muted-foreground" role="status" data-testid="status-live-room">{liveRoom.status === 'connected' ? `${liveRoom.remoteParticipants.length + 1} device${liveRoom.remoteParticipants.length === 0 ? '' : 's'} connected` : liveRoom.status === 'connecting' ? 'Connecting to the live room…' : liveRoom.status === 'reconnecting' ? 'Reconnecting to the live room…' : liveRoom.status === 'unsupported' ? 'Live video is not supported here. Local controls still work.' : liveRoom.status === 'error' ? 'Live room is unavailable. You can still study locally.' : 'Live room is off'}</div><button onClick={() => { if (inRoom) stopMedia(); setInRoom(!inRoom); setSessionStarted(false); }} className="mt-2 w-full rounded-xl py-2 text-[11px] font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground" data-testid="button-leave-room">{inRoom ? 'Leave this room' : 'Rejoin this room'}</button></div>
         <div className="rounded-[24px] border border-border bg-card/90 p-5 shadow-xs"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">In the room</p><h2 className="mt-1 font-display text-xl font-bold tracking-[-.04em]">{liveRoom.remoteParticipants.length + (inRoom ? 1 : 0)} connected</h2></div><button onClick={() => onAssistant(`${party.name}: ${party.description}`)} className="grid h-9 w-9 place-items-center rounded-xl bg-accent/60 text-accent-foreground transition hover:scale-105" data-testid="button-ask-assistant-room" aria-label="Ask study assistant"><Sparkles size={16} /></button></div><div className="mt-4 space-y-1">{inRoom && <Participant name={displayName} tone={palette} status={liveRoom.status === 'connected' ? 'You · connected' : 'You · local only'} />}{liveRoom.remoteParticipants.map((participant) => <Participant key={participant.id} name={participant.name} tone={participant.tone} status={participant.videoEnabled ? 'Camera on' : participant.micEnabled ? 'Voice only' : 'Muted'} />)}</div>{liveRoom.remoteParticipants.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{liveRoom.remoteParticipants.map((participant) => <RemoteVideoTile key={`video-${participant.id}`} participant={participant} />)}</div>}</div>
        <div className="rounded-[24px] border border-primary/15 bg-primary/10 p-5"><div className="flex gap-3"><span className="mt-0.5 text-primary"><Volume2 size={17} /></span><div><p className="text-xs font-bold">Keep it considerate</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">You can talk here, but keep your mic off during focus sprints.</p></div></div></div>
      </aside>
    </section>
    {joinOpen && <ModalFrame onClose={() => setJoinOpen(false)} eyebrow={party.subject} title={`Join ${party.name}`}><form onSubmit={join} className="mt-7"><Field label="Your name"><input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="form-input" data-testid="input-room-member-name" /></Field><button disabled={joinParty.isPending} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground" data-testid="button-submit-room-join">{joinParty.isPending && <Loader2 className="animate-spin" size={15} />} Join room</button></form></ModalFrame>}
  </div>;
}

function MessageSkeleton() { return <div className="flex gap-3 animate-pulse"><div className="h-8 w-8 rounded-xl bg-muted" /><div className="h-12 w-48 rounded-2xl bg-muted" /></div>; }
function ChatBubble({ item, mine, canDelete, onDelete, deleted }: { item: PartyMessage; mine: boolean; canDelete?: boolean; onDelete?: () => void; deleted?: boolean }) { return <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`} data-testid={`message-${item.id}`}><Avatar name={item.sender} tone={mine ? '#F2C94C' : '#4DB6A5'} /><div className={`max-w-[75%] ${mine ? 'text-right' : ''}`}><div className="mb-1 flex items-center gap-2 text-[10px] text-muted-foreground"><span className="font-bold text-foreground">{mine ? 'You' : item.sender}</span><span>{timeAgo(item.createdAt)}</span>{deleted && <span className="font-bold text-destructive">deleted</span>}{canDelete && <button type="button" onClick={onDelete} className="text-muted-foreground underline decoration-dotted hover:text-destructive" data-testid={`button-delete-${item.id}`}>delete</button>}</div><div className={`inline-block rounded-2xl px-4 py-3 text-sm leading-relaxed ${deleted ? 'border border-dashed border-destructive/30 bg-transparent text-muted-foreground' : mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted text-foreground'}`}>{item.content}</div></div></div>; }
function PlayIcon() { return <span className="grid h-4 w-4 place-items-center rounded-full border-2 border-current"><span className="ml-0.5 h-0 w-0 border-y-[3px] border-l-[5px] border-y-transparent border-l-current" /></span>; }

function Router({ preferences, updatePreferences }: { preferences: Preferences; updatePreferences: (patch: Partial<Preferences>) => void }) {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantContext, setAssistantContext] = useState<string>();
  const [searchOpen, setSearchOpen] = useState(false);
  const openAssistant = (context?: string) => { setAssistantContext(context); setAssistantOpen(true); };
  const persistAssistantName = useCallback((assistantName: string) => updatePreferences({ assistantName }), [updatePreferences]);
  return <Shell preferences={preferences} onSearch={() => setSearchOpen(true)} onAssistant={() => openAssistant()}><ErrorBoundary resetKey={window.location.pathname}><Switch><Route path="/" component={() => <DashboardPage onAssistant={() => openAssistant()} />} /><Route path="/party/:id" component={() => <PartyRoomPage onAssistant={openAssistant} />} /><Route path="/profile" component={() => <ProfilePage preferences={preferences} updatePreferences={updatePreferences} />} /><Route path="/settings" component={() => <SettingsPage preferences={preferences} updatePreferences={updatePreferences} />} /><Route path="/about" component={AboutPage} /><Route path="/privacy" component={PrivacyPolicyPage} /><Route path="/terms" component={TermsPage} /><Route path="/sign-in/*?" component={SignInPage} /><Route path="/sign-up/*?" component={SignUpPage} /><Route component={NotFound} /></Switch></ErrorBoundary>{assistantOpen && <AssistantModal initialName={preferences.assistantName} onNameChange={persistAssistantName} context={assistantContext} onClose={() => setAssistantOpen(false)} />}{searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}</Shell>;
}

function SignInPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function ClerkApp({ preferences, updatePreferences }: { preferences: Preferences; updatePreferences: (patch: Partial<Preferences>) => void }) {
  const [, setLocation] = useLocation();
  const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Keep your focus moving.' } }, signUp: { start: { title: 'Create your Study Party account', subtitle: 'Bring your profile with you.' } } }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}><QueryClientProvider client={queryClient}><TooltipProvider><Router preferences={preferences} updatePreferences={updatePreferences} /><Toaster /></TooltipProvider></QueryClientProvider></ClerkProvider>;
}

function App() {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  useEffect(() => {
    window.localStorage.setItem('study-party-preferences', JSON.stringify(preferences));
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.fontSize = preferences.fontSize;
    document.documentElement.classList.toggle('reduce-motion', preferences.reduceMotion);
    document.documentElement.style.setProperty('--primary', hslFromHex(preferences.accentColor));
  }, [preferences]);
  const updatePreferences = useCallback((patch: Partial<Preferences>) => setPreferences((current) => ({ ...current, ...patch })), []);
  return <WouterRouter base={basePath}><ClerkApp preferences={preferences} updatePreferences={updatePreferences} /></WouterRouter>;
}

export default App;