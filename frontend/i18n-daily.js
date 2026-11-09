// Text for the Daily Update tab, merged into I18N (loaded after i18n.js).
const DAILY_TEXT = {
  en: { tab_daily: "Daily Update", daily_title: "Today from your team", daily_intro: "One idea from each member of your team, picked for your family today. Ideas, not instructions.",
    daily_loading: "Your team is putting today's ideas together…", daily_ask: "Ask about this", daily_ask_q: "Tell me more about today's idea from {name}: “{title}”",
    daily_error: "Today's update could not load. Please try again in a moment.", daily_retry: "Try again", daily_cost: "Made once today for {cost}", daily_source: "Source" },
  es: { tab_daily: "Novedades del día", daily_title: "Hoy de tu equipo", daily_intro: "Una idea de cada miembro de tu equipo, elegida para tu familia hoy. Ideas, no instrucciones.",
    daily_loading: "Tu equipo está preparando las ideas de hoy…", daily_ask: "Preguntar sobre esto", daily_ask_q: "Cuéntame más sobre la idea de hoy de {name}: «{title}»",
    daily_error: "No se pudo cargar la novedad de hoy. Inténtalo de nuevo en un momento.", daily_retry: "Reintentar", daily_cost: "Hecho una vez hoy por {cost}", daily_source: "Fuente" },
  zh: { tab_daily: "每日更新", daily_title: "今日团队建议", daily_intro: "团队每位成员今天为您家庭挑选的一个想法。仅供参考，不是指令。",
    daily_loading: "团队正在整理今天的想法…", daily_ask: "详细问问", daily_ask_q: "请多讲讲 {name} 今天的想法：“{title}”",
    daily_error: "今日更新无法加载，请稍后再试。", daily_retry: "重试", daily_cost: "今日生成一次，花费 {cost}", daily_source: "来源" },
  pt: { tab_daily: "Novidades do dia", daily_title: "Hoje da sua equipe", daily_intro: "Uma ideia de cada membro da sua equipe, escolhida para sua família hoje. Ideias, não instruções.",
    daily_loading: "Sua equipe está preparando as ideias de hoje…", daily_ask: "Perguntar sobre isso", daily_ask_q: "Conte mais sobre a ideia de hoje de {name}: “{title}”",
    daily_error: "Não foi possível carregar a novidade de hoje. Tente de novo em instantes.", daily_retry: "Tentar de novo", daily_cost: "Feito uma vez hoje por {cost}", daily_source: "Fonte" },
  fr: { tab_daily: "Le point du jour", daily_title: "Aujourd'hui, de votre équipe", daily_intro: "Une idée de chaque membre de votre équipe, choisie pour votre famille aujourd'hui. Des idées, pas des consignes.",
    daily_loading: "Votre équipe prépare les idées du jour…", daily_ask: "En savoir plus", daily_ask_q: "Dites-m'en plus sur l'idée du jour de {name} : « {title} »",
    daily_error: "Le point du jour n'a pas pu se charger. Réessayez dans un instant.", daily_retry: "Réessayer", daily_cost: "Fait une fois aujourd'hui pour {cost}", daily_source: "Source" },
  bn: { tab_daily: "আজকের আপডেট", daily_title: "আজ আপনার দল থেকে", daily_intro: "আপনার দলের প্রত্যেক সদস্যের কাছ থেকে একটি করে ভাবনা, আজ আপনার পরিবারের জন্য বাছাই করা। শুধু ভাবনা, নির্দেশ নয়।",
    daily_loading: "আপনার দল আজকের ভাবনাগুলো সাজাচ্ছে…", daily_ask: "এ নিয়ে জিজ্ঞেস করুন", daily_ask_q: "{name}-এর আজকের ভাবনা সম্পর্কে আরও বলুন: “{title}”",
    daily_error: "আজকের আপডেট লোড হয়নি। একটু পরে আবার চেষ্টা করুন।", daily_retry: "আবার চেষ্টা করুন", daily_cost: "আজ একবার তৈরি, খরচ {cost}", daily_source: "সূত্র" },
};
Object.keys(DAILY_TEXT).forEach(l => Object.assign(I18N[l], DAILY_TEXT[l]));
