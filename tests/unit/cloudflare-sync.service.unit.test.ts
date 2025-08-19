import { jest } from '@jest/globals';
import { CloudflareSyncService } from '../../src/services/cloudflare-sync.service';
import { RulesetResult } from '../../src/types';
import { mockEnv } from '../fixtures/env.mock';
import { mockLogger } from '../fixtures/logger.mock';
import { CloudflareAPI } from '../../src/clients/cloudflare.client';

// Mock the entire CloudflareAPI module to ensure no real network calls are made.
jest.mock('../../src/clients/cloudflare.client');

describe('CloudflareSyncService Unit Tests', () => {
  let service: CloudflareSyncService;
  let mockCloudflareClient: jest.Mocked<CloudflareAPI>;

  beforeEach(() => {
    // Clear all mock function calls before each test.
    jest.clearAllMocks();
    
    // Get a correctly typed mocked instance of the CloudflareAPI
    mockCloudflareClient = new CloudflareAPI(mockLogger) as jest.Mocked<CloudflareAPI>;
    service = new CloudflareSyncService(mockEnv, mockCloudflareClient, mockLogger);
  });

  describe('Successful Sync', () => {

    it('should run correctly if ruleset and rule already exist', async () => {
      // Mock the public methods of the mock client to simulate the happy path.
      mockCloudflareClient.getRulesetByPhase.mockResolvedValue({
        id: 'existing-ruleset-id',
        rules: [{ id: 'existing-rule-id', description: 'test-rule' }],
      } as RulesetResult);
      mockCloudflareClient.updateRule.mockResolvedValue(undefined);
  
      // The syncBans method will now use our mocks instead of making a real API call.
      const result = await service.syncBans('example.com', { '1.1.1.1': 3600 });
  
      // Assert that the mocked methods were called as expected.
      expect(mockCloudflareClient.getRulesetByPhase).toHaveBeenCalledTimes(1);
      expect(mockCloudflareClient.updateRule).toHaveBeenCalledTimes(1);
      
      // Assert that the create methods were not called.
      expect(mockCloudflareClient.createRuleset).not.toHaveBeenCalled();
      expect(mockCloudflareClient.createRule).not.toHaveBeenCalled();
      expect(result).toBe('Successfully synced 1 IP bans for example.com');
    });
  
    it('should create ruleset and rule if they do not exist', async () => {
      // Mock the dependency's public methods to simulate creating new resources.
      mockCloudflareClient.getRulesetByPhase
        .mockResolvedValueOnce(null) // First call: ruleset does not exist.
        .mockResolvedValueOnce({ // Second call: after creation, the ruleset exists.
          id: 'new-ruleset-id',
          rules: [],
        } as RulesetResult);
      mockCloudflareClient.createRuleset.mockResolvedValue({
        id: 'new-ruleset-id',
        rules: [],
      } as RulesetResult);
      mockCloudflareClient.createRule.mockResolvedValue('new-rule-id');
      mockCloudflareClient.updateRule.mockResolvedValue(undefined);
  
      const result = await service.syncBans('example.com', { '1.1.1.1': 3600 });
  
      // Assert that all the creation and update methods were called.
      expect(mockCloudflareClient.getRulesetByPhase).toHaveBeenCalledTimes(2);
      expect(mockCloudflareClient.createRuleset).toHaveBeenCalledTimes(1);
      expect(mockCloudflareClient.createRule).toHaveBeenCalledTimes(1);
      expect(mockCloudflareClient.updateRule).toHaveBeenCalledTimes(1);
      expect(result).toBe('Successfully synced 1 IP bans for example.com');
    });
  
    it('should create a rule if it does not exist in an existing ruleset', async () => {
      // Mock the dependency's public methods to simulate a missing rule.
      mockCloudflareClient.getRulesetByPhase.mockResolvedValue({
        id: 'existing-ruleset-id',
        rules: [],
      } as RulesetResult);
      mockCloudflareClient.createRule.mockResolvedValue('new-rule-id');
      mockCloudflareClient.updateRule.mockResolvedValue(undefined);
  
      const result = await service.syncBans('example.com', { '1.1.1.1': 3600 });  
  
      // Assert that the rule was created and updated, but no ruleset was created.
      expect(mockCloudflareClient.getRulesetByPhase).toHaveBeenCalledTimes(1);
      expect(mockCloudflareClient.createRule).toHaveBeenCalledTimes(1);
      expect(mockCloudflareClient.updateRule).toHaveBeenCalledTimes(1);
      expect(mockCloudflareClient.createRuleset).not.toHaveBeenCalled();
      expect(result).toBe('Successfully synced 1 IP bans for example.com');
    });

  });

  describe('Error Handling', () => {

    it('should throw an error if rule creation fails', async () => {
      // Mock the dependency to simulate an error when creating a rule.
      mockCloudflareClient.getRulesetByPhase.mockResolvedValue({
        id: 'existing-ruleset-id',
        rules: [],
      } as RulesetResult);
      mockCloudflareClient.createRule.mockRejectedValue(new Error('API error: Failed to create rule'));
  
      // Assert that the public method throws an error as expected.
      await expect(service.syncBans('example.com', { '1.1.1.1': 3600 })).rejects.toThrow('API error: Failed to create rule');
      
      // Assert that createRuleset was not called, as the failure happens after.
      expect(mockCloudflareClient.createRuleset).not.toHaveBeenCalled();
      // The updateRule method should not be called at all.
      expect(mockCloudflareClient.updateRule).not.toHaveBeenCalled();
    });
  
    it('should throw an error if ruleset creation fails', async () => {
      // Mock the dependency to simulate a ruleset not existing and the creation call failing.
      mockCloudflareClient.getRulesetByPhase.mockResolvedValue(null);
      mockCloudflareClient.createRuleset.mockRejectedValue(new Error('API error: Failed to create ruleset'));
  
      // Assert that the public method throws an error as expected.
      await expect(service.syncBans('example.com', { '1.1.1.1': 3600 })).rejects.toThrow('API error: Failed to create ruleset');
  
      // Assert that other methods were not called.
      expect(mockCloudflareClient.createRule).not.toHaveBeenCalled();
      expect(mockCloudflareClient.updateRule).not.toHaveBeenCalled();
    });
  
    it('should throw an error if rule update fails', async () => {
      // Mock the dependencies to simulate a successful lookup but a failed update.
      mockCloudflareClient.getRulesetByPhase.mockResolvedValue({
        id: 'existing-ruleset-id',
        rules: [{ id: 'existing-rule-id', description: 'test-rule' }],
      } as RulesetResult);
      mockCloudflareClient.updateRule.mockRejectedValue(new Error('API error: Failed to update rule'));
  
      // Assert that the public method throws an error as expected.
      await expect(service.syncBans('example.com', { '1.1.1.1': 3600 })).rejects.toThrow('API error: Failed to update rule');
      
      // Assert that create methods were not called.
      expect(mockCloudflareClient.createRuleset).not.toHaveBeenCalled();
      expect(mockCloudflareClient.createRule).not.toHaveBeenCalled();
    });

  });
});
