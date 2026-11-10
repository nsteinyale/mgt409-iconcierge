// Text for Guest / Beta mode, merged into I18N (loaded after i18n.js).
const GUEST_TEXT = {
  en: { or: "or", guest_btn: "Guest / Beta mode", guest_hint: "Try iConcierge without an account. Your guest space stays in this browser for up to 7 days.",
    guest_badge: "Guest · Beta", guest_badge_tip: "Guest / Beta mode: no account. Signing out ends access to this guest space.",
    guest_leave: "Leave Guest / Beta mode? Your guest space (chats, to-dos, documents, drafts) can't be opened again after you sign out." },
  es: { or: "o", guest_btn: "Modo invitado / beta", guest_hint: "Prueba iConcierge sin cuenta. Tu espacio de invitado se queda en este navegador hasta 7 días.",
    guest_badge: "Invitado · Beta", guest_badge_tip: "Modo invitado / beta: sin cuenta. Al cerrar sesión pierdes el acceso a este espacio.",
    guest_leave: "¿Salir del modo invitado / beta? Tu espacio de invitado (chats, tareas, documentos, borradores) no se podrá abrir de nuevo después de cerrar sesión." },
  zh: { or: "或", guest_btn: "访客 / 测试模式", guest_hint: "无需账户即可试用 iConcierge。访客空间在此浏览器中最多保留 7 天。",
    guest_badge: "访客 · 测试", guest_badge_tip: "访客 / 测试模式：无账户。退出后将无法再打开此访客空间。",
    guest_leave: "退出访客 / 测试模式？退出后，您的访客空间（对话、待办、文件、草稿）将无法再打开。" },
  pt: { or: "ou", guest_btn: "Modo convidado / beta", guest_hint: "Experimente o iConcierge sem conta. Seu espaço de convidado fica neste navegador por até 7 dias.",
    guest_badge: "Convidado · Beta", guest_badge_tip: "Modo convidado / beta: sem conta. Ao sair, você perde o acesso a este espaço.",
    guest_leave: "Sair do modo convidado / beta? Seu espaço de convidado (conversas, tarefas, documentos, rascunhos) não poderá ser aberto de novo depois de sair." },
  fr: { or: "ou", guest_btn: "Mode invité / bêta", guest_hint: "Essayez iConcierge sans compte. Votre espace invité reste dans ce navigateur jusqu'à 7 jours.",
    guest_badge: "Invité · Bêta", guest_badge_tip: "Mode invité / bêta : sans compte. Se déconnecter met fin à l'accès à cet espace.",
    guest_leave: "Quitter le mode invité / bêta ? Votre espace invité (conversations, tâches, documents, brouillons) ne pourra plus être ouvert après la déconnexion." },
  bn: { or: "অথবা", guest_btn: "অতিথি / বেটা মোড", guest_hint: "অ্যাকাউন্ট ছাড়াই iConcierge ব্যবহার করে দেখুন। আপনার অতিথি স্থান এই ব্রাউজারে ৭ দিন পর্যন্ত থাকে।",
    guest_badge: "অতিথি · বেটা", guest_badge_tip: "অতিথি / বেটা মোড: কোনো অ্যাকাউন্ট নেই। সাইন আউট করলে এই অতিথি স্থানে আর ঢোকা যাবে না।",
    guest_leave: "অতিথি / বেটা মোড ছাড়বেন? সাইন আউট করার পর আপনার অতিথি স্থান (চ্যাট, কাজের তালিকা, নথি, খসড়া) আর খোলা যাবে না।" },
};
Object.keys(GUEST_TEXT).forEach(l => Object.assign(I18N[l], GUEST_TEXT[l]));
