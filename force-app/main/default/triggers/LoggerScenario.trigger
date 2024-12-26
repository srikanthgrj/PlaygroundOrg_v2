trigger LoggerScenario on LoggerScenario__c(before insert, before update, before delete, after insert, after update, after delete, after undelete) {
  LoggerSObjectHandler.getHandler(Schema.LoggerScenario__c.SObjectType, new LoggerScenarioHandler()).execute();
}