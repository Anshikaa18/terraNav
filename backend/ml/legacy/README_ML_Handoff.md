# ChunkFlow ML handoff package

## Included
- `ChunkFlow_Model_Ready_Clean_Labels.csv`: 44,680 rows, 23 model features, split, and 2 targets. The six engineered features are descriptively named rather than carrying the temporary `LEAK` prefix.
- `ChunkFlow_Trained_Models_and_Preprocessing.joblib`: two HistGradientBoostingRegressor models, the exact feature order, and train-fitted transformation parameters.
- `chunkflow_pipeline.py`: preprocessing and prediction function for rows from the Phase-2 processed CSV.
- `model_evaluation_summary.json`: validation/test metrics.

## Transformations inferred from the supplied files
- Five synthetic numeric input columns use `log1p` then standardization using training-partition mean/std.
- Chunk length, capacity utilization, average speed, road traffic volume, incident reports, and queue-per-chunk-length use standardization.
- Roadwork activity yes/no is converted to a binary feature and standardized.
- Chunk volume-per-km proxy uses `log1p` then standardization.
- Traffic signal, roadwork-in-chunk, weather, and chunk-sequence indicators are one-hot/binary 0/1 features.
- Split labels and targets are preserved from the model-ready file.

## Important limitation
The density target (`Observed Chunk Traffic Density (veh/km)`) does not exist as a direct column in the supplied Phase-2 processed CSV. It is preserved from the supplied model-ready CSV, assuming row order alignment; row alignment was checked using the shared synthetic-speed column. For a new inference dataset, do not expect the density target column in inputs. Predictions are generated from features only.

The speed target is explicitly synthetic. Scores describe performance on this dataset, not independently verified real-world traffic prediction.

The renamed engineered features are semantically descriptive, not proof that they are non-leaky or physically valid. Verify each source formula before making real-world claims.
