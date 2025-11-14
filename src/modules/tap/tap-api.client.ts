import axios, { AxiosInstance } from 'axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * TAP API Axios Client
 * Configured axios instance for TAP service communication with Basic Authentication
 */
@Injectable()
export class TapApiClient {
  private readonly logger = new Logger(TapApiClient.name);
  private readonly axiosInstance: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const tapServiceUrl = this.configService.get<string>('TAP_SERVICE_URL');
    const tapServiceUser = this.configService.get<string>('TAP_SERVICE_USER');
    const tapServicePassword = this.configService.get<string>('TAP_SERVICE_PASSWORD');

    if (!tapServiceUrl) {
      this.logger.warn('TAP_SERVICE_URL is not configured');
    }

    if (!tapServiceUser || !tapServicePassword) {
      this.logger.warn('TAP_SERVICE_USER or TAP_SERVICE_PASSWORD is not configured');
    }

    // Create Basic Auth token
    const auth = `${tapServiceUser}:${tapServicePassword}`;
    const encodedAuth = Buffer.from(auth).toString('base64');

    // Create axios instance with configuration
    this.axiosInstance = axios.create({
      baseURL: tapServiceUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encodedAuth}`,
      },
      timeout: 30000, // 30 seconds timeout
    });

    // Request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.logger.debug(`TAP API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('TAP API Request Error:', error.message);
        return Promise.reject(error);
      },
    );

    // Response interceptor for logging and error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.debug(
          `TAP API Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`,
        );
        return response;
      },
      (error) => {
        if (error.response) {
          this.logger.error(
            `TAP API Error Response: ${error.response.status} ${error.response.statusText} - ${error.config?.url}`,
          );
        } else if (error.request) {
          this.logger.error('TAP API No Response:', error.message);
        } else {
          this.logger.error('TAP API Request Setup Error:', error.message);
        }
        return Promise.reject(error);
      },
    );
  }

  /**
   * Get the configured axios instance
   */
  getClient(): AxiosInstance {
    return this.axiosInstance;
  }

  /**
   * Check if the client is properly configured
   */
  isConfigured(): boolean {
    const tapServiceUrl = this.configService.get<string>('TAP_SERVICE_URL');
    const tapServiceUser = this.configService.get<string>('TAP_SERVICE_USER');
    const tapServicePassword = this.configService.get<string>('TAP_SERVICE_PASSWORD');

    return !!(tapServiceUrl && tapServiceUser && tapServicePassword);
  }
}
