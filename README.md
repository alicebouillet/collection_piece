# Collection de 2 euros

Application personnelle pour suivre une collection de pièces en euros : les
huit valeurs faciales de 1 centime à 2 euros, faces nationales et
commémoratives, marquage de ce qu'on possède, et identification d'une pièce à
partir d'une photo.

## Comment c'est construit

```
data/        récupération du catalogue depuis le site de la BCE
supabase/    schéma de la base (tables, vue, recherche vectorielle, RLS)
backend/     API FastAPI : reconnaissance d'une photo, import du catalogue
frontend/    interface React (Vite)
```

L'identification repose sur des embeddings CLIP plutôt que sur un classifieur
entraîné : avec une seule image de référence par type et plusieurs centaines de
commémoratives, une recherche de similarité donne de meilleurs résultats qu'un
modèle réentraîné, et se met à jour en ajoutant simplement une ligne en base.

## Deux points de modélisation

**La valeur faciale ne se devine pas sur une photo.** Beaucoup de pays gravent
le même motif sur 1, 2 et 5 centimes, et un autre motif commun sur 10, 20 et
50. Seuls le diamètre et la couleur les séparent, et le diamètre n'est pas
récupérable sans référence d'échelle. L'utilisateur choisit donc la valeur d'un
tap avant de photographier, ce qui restreint la recherche à une vingtaine de
types au lieu de sept cents.

**Une pièce courante n'a pas d'année.** Le motif de la face nationale est
identique d'une année sur l'autre : aucun modèle ne peut distinguer un exemplaire
2004 d'un 2019. Les pièces courantes sont donc indexées par pays et par version
de face, pas par millésime. Les refontes (Belgique, Espagne, Vatican, Monaco…) et
les ateliers allemands comptent comme des versions distinctes.

**L'identification propose, l'utilisateur décide.** L'API renvoie les trois types
les plus proches avec un score. Le top-1 seul n'est pas assez fiable pour être
enregistré automatiquement.

## Montage

### 1. Base de données

Exécuter `supabase/schema.sql` dans le SQL Editor du projet Supabase. Dans
Authentication, activer la connexion par lien magique.

### 2. Catalogue

```bash
cd data
pip install -r requirements.txt
python scrape_ecb.py --inspect 2015        # vérifier la structure des pages
python scrape_ecb.py --inspect courantes   # idem pour les faces nationales
python scrape_ecb.py --courantes --comm    # récupérer images + catalog.json
```

Le mode `--inspect` affiche les premières images d'une page avec leur contexte :
à lancer avant le scraping complet, et à relancer sur une année ancienne et une
année récente pour confirmer que la convention de nommage n'a pas changé.
Compter 25 à 35 minutes : huit pages de faces nationales et une vingtaine
d'années de commémoratives, avec une pause d'une seconde entre chaque requête.

### 3. Import en base

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # renseigner les clés Supabase
python seed_supabase.py
```

Les embeddings sont calculés localement (CLIP ViT-B/32, CPU suffisant). Une fois
tous les vecteurs chargés, recréer l'index ivfflat pour qu'il se calibre sur les
données réelles :

```sql
reindex index coin_types_embedding_idx;
```

### 4. API

```bash
cd backend
uvicorn main:app --reload
```

### 5. Interface

```bash
cd frontend
npm install
cp .env.example .env        # renseigner l'URL Supabase et celle de l'API
npm run dev
```

## Ordre de construction conseillé

L'application est utilisable dès l'étape 5 sans la reconnaissance : catalogue
visible, ajout et retrait manuels, filtres, avancement. La photo est un confort
qui s'ajoute ensuite. Le vrai goulot d'étranglement du projet est le catalogue,
pas le modèle.

## Sources

Images et descriptions des pièces : site de la Banque centrale européenne,
section « L'euro / Les pièces ». Réutilisation non commerciale avec mention de
la source. La BCE signale elle-même que ses pages peuvent avoir du retard sur le
*Journal officiel de l'Union européenne* (série C), qui fait référence pour les
émissions commémoratives.
