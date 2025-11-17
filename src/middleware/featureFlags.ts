import { RequestHandler } from 'express';
import { config } from '../config';

type FeatureKey = keyof typeof config.features;

interface EnsureFeatureOptions {
  statusCode?: number;
  message?: string;
}

export const ensureFeatureEnabled = (
  feature: FeatureKey,
  options?: EnsureFeatureOptions
): RequestHandler => {
  const statusCode = options?.statusCode ?? 404;
  const message = options?.message ?? 'feature_disabled';

  return (_req, res, next) => {
    if (!config.features[feature]) {
      return res.status(statusCode).json({
        success: false,
        message,
        feature,
      });
    }

    return next();
  };
};


