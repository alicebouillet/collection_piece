-- =========================================================================
-- Collection de pièces de 2 euros — schéma Supabase
-- À exécuter dans le SQL Editor du projet Supabase.
-- =========================================================================

create extension if not exists vector;

-- -------------------------------------------------------------------------
-- Référentiel : un enregistrement par TYPE de pièce.
--
-- Rappel de modélisation :
--   - une pièce courante n'a pas d'année (le motif est identique d'une année
--     sur l'autre), mais peut avoir plusieurs versions de face nationale
--     (refontes belges, espagnoles, ateliers allemands...) -> version_face
--   - une commémorative est identifiée par (pays, année, thème)
-- -------------------------------------------------------------------------
create table if not exists coin_types (
    id            text primary key,              -- slug, ex. "2015_be_flag"
    valeur        int not null,                  -- en centimes : 1,2,5,10,20,50,100,200
    type          text not null check (type in ('courante', 'commemorative')),
    pays_code     text not null,                 -- ISO 3166-1 alpha-2, ex. "be"
    pays          text not null,                 -- libellé FR, ex. "Belgique"
    annee         int,                           -- null si courante
    theme         text,                          -- null si courante
    version_face  text,                          -- ex. "2008-", "atelier A"
    image_url     text not null,
    source_url    text,
    embedding     vector(512),                   -- CLIP ViT-B/32
    created_at    timestamptz not null default now()
);

create index if not exists coin_types_valeur_idx    on coin_types (valeur);
create index if not exists coin_types_type_idx      on coin_types (type);
create index if not exists coin_types_pays_idx      on coin_types (pays_code);
create index if not exists coin_types_annee_idx     on coin_types (annee);

-- Index de similarité cosinus. À (re)créer APRÈS avoir inséré les embeddings :
-- ivfflat a besoin de données pour calibrer ses listes.
create index if not exists coin_types_embedding_idx
    on coin_types using ivfflat (embedding vector_cosine_ops) with (lists = 32);

-- -------------------------------------------------------------------------
-- Collection personnelle : ce que l'utilisateur possède réellement.
-- -------------------------------------------------------------------------
create table if not exists collection (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users (id) on delete cascade,
    coin_type_id  text not null references coin_types (id) on delete cascade,
    quantite      int  not null default 1 check (quantite > 0),
    etat          text check (etat in ('circulee', 'tres_bon_etat', 'neuve')),
    note          text,
    date_ajout    timestamptz not null default now(),
    unique (user_id, coin_type_id)
);

create index if not exists collection_user_idx on collection (user_id);

-- -------------------------------------------------------------------------
-- Vue "Pokédex" : tout le catalogue, avec l'état de possession.
-- La jointure gauche garantit que les pièces manquantes restent visibles.
-- -------------------------------------------------------------------------
create or replace view vue_catalogue
with (security_invoker = true) as
select
    ct.*,
    (c.id is not null) as possedee,
    coalesce(c.quantite, 0) as quantite,
    c.etat,
    c.note,
    c.date_ajout
from coin_types ct
left join collection c
    on c.coin_type_id = ct.id
   and c.user_id = auth.uid();

-- -------------------------------------------------------------------------
-- Recherche par similarité : renvoie les N types les plus proches d'une photo.
-- Appelée depuis le backend via supabase.rpc('match_coins', ...).
-- -------------------------------------------------------------------------
create or replace function match_coins(
    query_embedding vector(512),
    match_count     int default 3,
    filtre_valeur   int default null
)
returns table (
    id        text,
    valeur    int,
    type      text,
    pays      text,
    pays_code text,
    annee     int,
    theme     text,
    image_url text,
    score     float
)
language sql stable
as $$
    select
        ct.id,
        ct.valeur,
        ct.type,
        ct.pays,
        ct.pays_code,
        ct.annee,
        ct.theme,
        ct.image_url,
        1 - (ct.embedding <=> query_embedding) as score
    from coin_types ct
    where ct.embedding is not null
      -- Le motif ne distingue pas 1c de 2c de 5c : beaucoup de pays y mettent
      -- le même dessin. La valeur est donnée par l'utilisateur, pas devinée.
      and (filtre_valeur is null or ct.valeur = filtre_valeur)
    order by ct.embedding <=> query_embedding
    limit match_count;
$$;

-- -------------------------------------------------------------------------
-- Sécurité : le catalogue est public en lecture, la collection est privée.
-- -------------------------------------------------------------------------
alter table coin_types enable row level security;
alter table collection enable row level security;

drop policy if exists "catalogue lisible par tous" on coin_types;
create policy "catalogue lisible par tous"
    on coin_types for select
    using (true);

drop policy if exists "collection privee" on collection;
create policy "collection privee"
    on collection for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
