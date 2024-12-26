trigger LogEntryTag on LogEntryTag__c(before insert, before update, before delete, after insert, after update, after delete, after undelete) {
  LoggerSObjectHandler.getHandler(Schema.LogEntryTag__c.SObjectType, new LogEntryTagHandler()).execute();
}