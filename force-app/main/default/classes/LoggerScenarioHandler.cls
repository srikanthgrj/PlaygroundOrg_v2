/**
 * @group Log Management
 * @description Handles trigger events for the `LoggerScenario__c` object
 */
public without sharing class LoggerScenarioHandler extends LoggerSObjectHandler {
  /**
   * @description Returns SObject Type that the handler is responsible for processing
   * @return      The instance of `SObjectType`
   */
  public override Schema.SObjectType getSObjectType() {
    return Schema.LoggerScenario__c.SObjectType;
  }
}