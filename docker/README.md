# Local MongoDB for development

Spins up MongoDB 7 with the official MongoDB Atlas sample datasets, so you
can try `mongosh-llm` immediately without connecting to a real database.

## Usage

```
docker compose up -d
```

The first run downloads and restores the sample dataset archive, which can
take a minute or two. Subsequent `docker compose up` runs skip this (a
marker file is stored in the `seed-status` volume).

Connect with:

```
MONGODB_URI=mongodb://localhost:27017
```

## Sample databases loaded

- `sample_mflix` - movies, comments, users
- `sample_airbnb` - Airbnb listings and reviews
- `sample_restaurants` - NYC restaurant inspections
- `sample_analytics` - customers, accounts, transactions
- `sample_supplies` - sales records
- `sample_training` - grades, companies, posts
- `sample_geospatial` - shipwreck locations
- `sample_weatherdata` - weather station data

## Resetting

To wipe all data and re-seed from scratch:

```
docker compose down -v
docker compose up -d
```
