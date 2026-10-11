// Outils que l'assistant Claude peut utiliser dans Caddr (format « tools » de l'API Claude).
// Fichier partagé : lu par la fonction serveur (envoyé à l'API) et par l'app (exécution).

const DATE = { type: 'string', description: 'Date au format AAAA-MM-JJ' };
const TIME = { type: 'string', description: 'Heure au format HH:mm (24 h)' };

export const ASSISTANT_TOOLS = [
  {
    name: 'create_task',
    description: "Crée une tâche dans la Routine. Ponctuelle (un jour précis) ou récurrente. Si aucune date ni récurrence n'est donnée, la tâche est pour aujourd'hui. Choisis le bloc existant le plus logique (par son nom) ; un nom de bloc inconnu crée un nouveau bloc.",
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Intitulé court et concret' },
        block: { type: 'string', description: 'Nom du bloc (ex. « Matin », « Travail »)' },
        recurrence: { type: 'string', enum: ['once', 'daily', 'weekdays', 'weekends', 'weekly', 'period'], description: 'once = un seul jour (date) ; weekly = chaque semaine le même jour que date ; period = de start_date à end_date' },
        date: { ...DATE, description: 'Jour de la tâche (once) ou premier jour (weekly)' },
        start_date: DATE,
        end_date: DATE,
        start_time: TIME,
        duration: { type: 'integer', description: 'Durée en minutes' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        notes: { type: 'string' },
        is_habit: { type: 'boolean', description: 'Suivre comme habitude dans les statistiques' },
        goal_id: { type: 'string', description: "Relie la tâche à un objectif long terme (sa progression en tiendra compte)" },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description: "Modifie une tâche existante (titre, heure, durée, priorité, notes). start_time vide (\"\") retire l'heure. Pour une tâche récurrente, la modification vaut pour tous les jours à venir.",
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' }, title: { type: 'string' }, start_time: { type: 'string' },
        duration: { type: 'integer' }, priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        notes: { type: 'string' }, is_habit: { type: 'boolean' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'reschedule_task',
    description: "Déplace une tâche ponctuelle vers un autre jour (et éventuellement une heure). Pour une tâche récurrente, seule l'heure change.",
    input_schema: { type: 'object', properties: { task_id: { type: 'string' }, date: DATE, start_time: TIME }, required: ['task_id', 'date'] },
  },
  {
    name: 'set_task_done',
    description: 'Coche (done = true) ou décoche une tâche pour un jour donné (par défaut aujourd’hui).',
    input_schema: { type: 'object', properties: { task_id: { type: 'string' }, date: DATE, done: { type: 'boolean' } }, required: ['task_id', 'done'] },
  },
  {
    name: 'skip_task',
    description: 'Saute une tâche pour un jour (choix assumé, avec un motif). Elle reste visible mais le motif est enregistré.',
    input_schema: { type: 'object', properties: { task_id: { type: 'string' }, date: DATE, reason: { type: 'string' } }, required: ['task_id', 'reason'] },
  },
  {
    name: 'remove_task',
    description: "Retire une tâche. Ponctuelle : supprimée. Récurrente : la récurrence s'arrête (l'historique est conservé). À n'utiliser que si l'utilisateur le demande clairement.",
    input_schema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] },
  },
  {
    name: 'create_habit',
    description: "Crée une habitude indépendante (onglet Habitudes), à prendre (build) ou à arrêter (quit, ex. « Ne plus fumer »).",
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' }, kind: { type: 'string', enum: ['build', 'quit'] },
        days: { type: 'array', items: { type: 'integer' }, description: 'Jours prévus : 0 = dimanche … 6 = samedi ; vide = tous les jours' },
        description: { type: 'string' }, show_in_routine: { type: 'boolean' },
      },
      required: ['name', 'kind'],
    },
  },
  {
    name: 'log_habit',
    description: 'Enregistre l’état d’une habitude un jour donné : done (réussi), fail (raté), skip (exempté), clear (effacer). Une note peut être ajoutée.',
    input_schema: { type: 'object', properties: { habit_id: { type: 'string' }, date: DATE, status: { type: 'string', enum: ['done', 'fail', 'skip', 'clear'] }, note: { type: 'string' } }, required: ['habit_id', 'status'] },
  },
  {
    name: 'add_to_inbox',
    description: 'Ajoute une idée ou une tâche à trier plus tard dans la Boîte de tâches.',
    input_schema: { type: 'object', properties: { title: { type: 'string' }, notes: { type: 'string' }, deadline: DATE }, required: ['title'] },
  },
  {
    name: 'set_objective',
    description: "Fixe l'objectif prioritaire d'un jour (scope day) ou d'une semaine (scope week, date = n'importe quel jour de la semaine).",
    input_schema: { type: 'object', properties: { scope: { type: 'string', enum: ['day', 'week'] }, date: DATE, title: { type: 'string' } }, required: ['scope', 'title'] },
  },
  {
    name: 'create_goal',
    description: 'Crée un objectif long terme, avec échéance et blocs reliés (sa progression se calcule alors automatiquement).',
    input_schema: { type: 'object', properties: { title: { type: 'string' }, target_date: DATE, linked_blocks: { type: 'array', items: { type: 'string' } } }, required: ['title'] },
  },
  {
    name: 'create_block',
    description: 'Crée un bloc de la Routine (ensemble de tâches), récurrent ou pour un seul jour.',
    input_schema: { type: 'object', properties: { title: { type: 'string' }, recurrence: { type: 'string', enum: ['daily', 'weekdays', 'weekends', 'once'] }, date: DATE }, required: ['title'] },
  },
  {
    name: 'write_journal',
    description: "Ajoute des gratitudes et/ou des fiertés au journal d'un jour (uniquement ce que l'utilisateur a dit lui-même).",
    input_schema: { type: 'object', properties: { date: DATE, gratitude: { type: 'array', items: { type: 'string' } }, pride: { type: 'array', items: { type: 'string' } }, note: { type: 'string' } } },
  },
  {
    name: 'add_milestones',
    description: "Ajoute des étapes (jalons datés) à un objectif long terme.",
    input_schema: { type: 'object', properties: { goal_id: { type: 'string' }, milestones: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, date: DATE }, required: ['title'] } } }, required: ['goal_id', 'milestones'] },
  },
  {
    name: 'set_milestone_done',
    description: "Marque une étape d'objectif comme atteinte (ou non).",
    input_schema: { type: 'object', properties: { goal_id: { type: 'string' }, milestone_id: { type: 'string' }, done: { type: 'boolean' } }, required: ['goal_id', 'milestone_id', 'done'] },
  },
  {
    name: 'remember',
    description: "Retient une préférence ou une contrainte DURABLE de l'utilisateur pour toutes les futures propositions (ex. « Pas de travail après 21 h », « Sport le matin », « Réunion d'équipe chaque lundi à 9 h »). Une phrase courte. Jamais d'information de santé, financière ou intime.",
    input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'forget',
    description: 'Oublie un élément de la mémoire (par son memory_id).',
    input_schema: { type: 'object', properties: { memory_id: { type: 'string' } }, required: ['memory_id'] },
  },
  {
    name: 'get_day',
    description: "Lit le détail d'un jour : blocs, tâches (id, heure, durée, fait ou non), tâches sautées, habitudes, objectif, rendez-vous externes.",
    input_schema: { type: 'object', properties: { date: DATE }, required: ['date'] },
  },
  {
    name: 'search',
    description: 'Cherche des tâches, idées de la Boîte, habitudes ou objectifs par mot-clé (renvoie leurs id).',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'get_stats',
    description: 'Statistiques de discipline : taux, tâches faites/prévues, détail par bloc et par jour, série, habitudes.',
    input_schema: { type: 'object', properties: { period: { type: 'string', enum: ['week', 'last_week', 'month', 'last_month', 'year'] } }, required: ['period'] },
  },
  {
    name: 'open_tab',
    description: "Ouvre un onglet de l'app pour l'utilisateur.",
    input_schema: { type: 'object', properties: { tab: { type: 'string', enum: ['routine', 'habits', 'schedule', 'inbox', 'journal', 'stats', 'ai', 'templates', 'settings'] } }, required: ['tab'] },
  },
] as const;

export const ASSISTANT_SYSTEM = `Tu es Claude, l'assistant intégré à Caddr, une application francophone de discipline personnelle : Routine (blocs de tâches quotidiennes), Habitudes, Planning (agenda), Boîte de tâches, Journal (gratitude et fierté), Analytics.

Ton rôle : aider l'utilisateur à organiser sa vie, structurer ses journées et atteindre ses objectifs. Tu peux AGIR dans l'app grâce aux outils : créer, déplacer, cocher, sauter ou retirer des tâches, créer et suivre des habitudes, fixer des objectifs, alimenter la Boîte ou le journal, lire ses statistiques.

Règles :
- Réponds en français, en tutoyant, de façon chaleureuse, directe et concise (2 à 5 phrases en général). Pas de jargon.
- Quand la demande est claire, agis tout de suite avec les outils, puis résume en une ou deux lignes ce que tu as fait (jour, heure, bloc).
- Valeurs par défaut raisonnables : sans date → aujourd'hui ; « demain », « lundi prochain »… se calculent à partir de la date du jour donnée dans le contexte ; sans bloc → le bloc existant le plus logique ; sans durée → 30 min.
- Ne pose une question que si une information indispensable manque ou si la demande est ambiguë.
- Avant de retirer des tâches ou de faire plus de 6 changements d'un coup, décris ton plan et demande confirmation, sauf si l'utilisateur a été explicite.
- N'utilise que des identifiants (id) présents dans le contexte ou renvoyés par un outil ; en cas de doute, utilise search ou get_day.
- Quand tu planifies une journée, tiens compte des heures déjà prises (tâches à heure fixe et rendez-vous externes), garde des pauses et ne surcharge pas.
- Coaching : bienveillant mais exigeant, jamais culpabilisant. Relie les tâches aux objectifs de vie de l'utilisateur quand c'est pertinent. Propose au plus une suggestion à la fin, si elle est utile.
- Mémoire : respecte toujours les préférences de la section MÉMOIRE du contexte. Quand l'utilisateur exprime une préférence ou une contrainte durable (ou dit « retiens que… »), enregistre-la avec remember, puis dis-le en une phrase. N'enregistre jamais d'informations de santé, de finances ou d'intimité.
- Objectifs de vie : pour transformer un objectif en plan, pose d'abord 2 ou 3 questions utiles (échéance, temps disponible, point de départ), puis propose un plan clair (jalons datés, tâches récurrentes, habitudes) et ne le crée qu'après l'accord de l'utilisateur ; relie alors les tâches à l'objectif (goal_id) et ajoute les jalons (add_milestones).
- Tu n'as accès qu'aux données de Caddr fournies dans le contexte et par les outils ; ne prétends pas avoir fait une action sans avoir appelé l'outil correspondant.`;
