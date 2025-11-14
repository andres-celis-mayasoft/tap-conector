import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TapApiClient } from './tap-api.client';
import { AxiosError } from 'axios';

/**
 * TAP Service
 * Handles communication with the TAP external service
 */
@Injectable()
export class TapService {
  private readonly logger = new Logger(TapService.name);
  private readonly tapServiceUrl: string | undefined;
  private readonly tapProjectId: number | undefined;

  private PROJECT_PARAMS_DICTIONARY : Map<string, string> = new Map()

  constructor(
    private readonly configService: ConfigService,
    private readonly tapApiClient: TapApiClient,
  ) {
    this.tapServiceUrl = this.configService.get<string>('TAP_SERVICE_URL');
    const projectIdStr = this.configService.get<string>('TAP_PROJECT_ID');
    this.tapProjectId = projectIdStr ? parseInt(projectIdStr, 10) : undefined;

    if (!this.tapServiceUrl) {
      this.logger.warn('TAP_SERVICE_URL is not configured');
    }

    if (!this.tapProjectId) {
      this.logger.warn('TAP_PROJECT_ID is not configured');
    }
  }

  /**
   * Get parameters from TAP service using axios client
   * @param projectId Optional project ID, defaults to TAP_PROJECT_ID from env
   * @returns Parameters from TAP service
   */
  async getParameters(projectId: number, parameter?: string) {

    try {
      const url = `proyecto/get-parametros?id=${projectId}`;
      this.logger.log(`Fetching parameters from TAP service: ${url}`);

      const axiosClient = this.tapApiClient.getClient();
      const response = await axiosClient.get(url);

      const data = response.data;
      this.logger.log(`Successfully fetched parameters for project ${projectId}`);

      this.PROJECT_PARAMS_DICTIONARY.set(projectId.toString(), data);
      if(parameter)
        return data.find(d => d.key === parameter).value;
      else return data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const axiosError = error as AxiosError;
      const status = axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const statusText = axiosError.response?.statusText || 'Unknown error';

      this.logger.error(
        `Error fetching parameters from TAP service: ${axiosError.message}`,
        axiosError.stack,
      );

      throw new HttpException(
        `Failed to fetch parameters from TAP service: ${status} ${statusText}`,
        status,
      );
    }
  }

  /**
   * Get max invoice ID from Meiko using axios client
   * @param projectId Optional project ID, defaults to TAP_PROJECT_ID from env
   * @returns Max invoice ID from Meiko
   */
  async getMaxId(projectId?: number) {
    const id = projectId || this.tapProjectId;

    if (!id) {
      throw new HttpException(
        'Project ID is required. Provide it as parameter or set TAP_PROJECT_ID in environment variables.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!this.tapApiClient.isConfigured()) {
      throw new HttpException(
        'TAP service is not configured properly. Check TAP_SERVICE_URL, TAP_SERVICE_USER, and TAP_SERVICE_PASSWORD.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const url = `meiko/max-id-factura?id=${id}`;
      this.logger.log(`Fetching max invoice ID from TAP service: ${url}`);

      const axiosClient = this.tapApiClient.getClient();
      const response = await axiosClient.get(url);

      const data = response.data;
      this.logger.log(`Successfully fetched max invoice ID for project ${id}`);

      return data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const axiosError = error as AxiosError;
      const status = axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const statusText = axiosError.response?.statusText || 'Unknown error';

      this.logger.error(
        `Error fetching max invoice ID from TAP service: ${axiosError.message}`,
        axiosError.stack,
      );

      throw new HttpException(
        `Failed to fetch max invoice ID from TAP service: ${status} ${statusText}`,
        status,
      );
    }
  }

  /**
   * Get the configured project ID
   */
  getProjectId(): number | undefined {
    return this.tapProjectId;
  }

  /**
   * Get the configured service URL
   */
  getServiceUrl(): string | undefined {
    return this.tapServiceUrl;
  }

  /**
   * Check if TAP service is configured
   */
  isConfigured(): boolean {
    return !!(this.tapServiceUrl && this.tapProjectId);
  }
}
