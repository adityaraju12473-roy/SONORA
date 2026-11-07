import { v2 as cloudinary } from 'cloudinary';
import { ENV } from './env';

if (ENV.hasCloudinary) {
  cloudinary.config({
    cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
    api_key: ENV.CLOUDINARY_API_KEY,
    api_secret: ENV.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary };

/**
 * Generates secure server-side signature for direct client-to-Cloudinary upload.
 * Keeps API secrets safe on the server.
 */
export function generateCloudinarySignature(folder = 'sonora/audio', resourceType = 'video') {
  if (!ENV.hasCloudinary) {
    throw new Error('Cloudinary credentials not configured in environment.');
  }

  const timestamp = Math.round(new Date().getTime() / 1000);
  const paramsToSign: Record<string, any> = {
    folder,
    timestamp,
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    ENV.CLOUDINARY_API_SECRET
  );

  return {
    signature,
    timestamp,
    apiKey: ENV.CLOUDINARY_API_KEY,
    cloudName: ENV.CLOUDINARY_CLOUD_NAME,
    folder,
    resourceType,
  };
}

/**
 * Uploads a file buffer directly to Cloudinary using streaming upload
 */
export async function uploadStreamToCloudinary(
  buffer: Buffer,
  options: {
    folder: string;
    resource_type?: 'auto' | 'image' | 'video' | 'raw';
    public_id?: string;
  }
): Promise<any> {
  if (!ENV.hasCloudinary) {
    throw new Error('Cloudinary credentials not configured on the server.');
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: options.resource_type || 'auto',
        public_id: options.public_id,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
}
