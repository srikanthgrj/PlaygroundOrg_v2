/*
The code below is originally from the project stacktrace.js - also released under the MIT License.
It provides cross-browser stack trace parsing, which is utilized internally by CFS Logger
to automatically track the source component that is logging. The original JavaScript code has been modified
to be used for CFS Logger, but credit goes to the contributors of stacktrace.js for the original implementation.
*/
const CHROME_IE_STACK_REGEXP = /^\s*at .*(\S+:\d+|\(native\))/m;
const SAFARI_NATIVE_CODE_REGEXP = /^(eval@)?(\[native code])?$/;

class ErrorStackParser {
  parse(error) {
    let stackTraceParticles;
    if (error.stack && error.stack.match(CHROME_IE_STACK_REGEXP)) {
      stackTraceParticles = this.parseV8OrIE(error);
    } else if (error.stack) {
      stackTraceParticles = this.parseFFOrSafari(error);
    } else {
      throw new Error('Cannot parse given Error object');
    }

    return stackTraceParticles;
  }

  // Separate line and column numbers from a string of the form: (URI:Line:Column)
  extractLocation(urlLike) {
    // Fail-fast but return locations like "(native)"
    if (urlLike.indexOf(':') === -1) {
      return [urlLike];
    }

    const regExp = /(.+?)(?::(\d+))?(?::(\d+))?$/;
    const parts = regExp.exec(urlLike.replace(/[()]/g, ''));
    return [parts[1], parts[2] || undefined, parts[3] || undefined];
  }

  parseV8OrIE(error) {
    const filtered = error.stack.split('\n').filter(function (line) {
      return !!line.match(CHROME_IE_STACK_REGEXP);
    }, this);

    return filtered.map(function (line) {
      if (line.indexOf('(eval ') > -1) {
        // Throw away eval information until we implement stacktrace.js/stackframe#8
        line = line.replace(/eval code/g, 'eval').replace(/(\(eval at [^()]*)|(\),.*$)/g, '');
      }
      let sanitizedLine = line.replace(/^\s+/, '').replace(/\(eval code/g, '(');

      // capture and preseve the parenthesized location "(/foo/my bar.js:12:87)" in
      // case it has spaces in it, as the string is split on \s+ later on
      const location = sanitizedLine.match(/ (\((.+):(\d+):(\d+)\)$)/);

      // remove the parenthesized location from the line, if it was matched
      sanitizedLine = location ? sanitizedLine.replace(location[0], '') : sanitizedLine;

      const tokens = sanitizedLine.split(/\s+/).slice(1);
      // if a location was matched, pass it to extractLocation() otherwise pop the last token
      const locationParts = this.extractLocation(location ? location[1] : tokens.pop());
      const proxyPrefix = 'Proxy.';
      let functionName = tokens.join(' ') || undefined;
      if (functionName?.startsWith('Proxy.')) {
        functionName = functionName.substring(functionName.indexOf(proxyPrefix) + proxyPrefix.length);
      }
      const fileName = ['eval', '<anonymous>'].indexOf(locationParts[0]) > -1 ? undefined : locationParts[0];

      return {
        functionName: functionName,
        fileName: fileName,
        lineNumber: locationParts[1],
        columnNumber: locationParts[2],
        source: line
      };
    }, this);
  }

  parseFFOrSafari(error) {
    const filtered = error.stack.split('\n').filter(function (line) {
      return !line.match(SAFARI_NATIVE_CODE_REGEXP);
    }, this);

    return filtered.map(function (line) {
      // Throw away eval information until we implement stacktrace.js/stackframe#8
      if (line.indexOf(' > eval') > -1) {
        line = line.replace(/ line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g, ':$1');
      }

      if (line.indexOf('@') === -1 && line.indexOf(':') === -1) {
        // Safari eval frames only have function names and nothing else
        return {
          functionName: line
        };
      }
      const functionNameRegex = /((.*".+"[^@]*)?[^@]*)(?:@)/;
      const matches = line.match(functionNameRegex);
      const functionName = matches && matches[1] ? matches[1] : undefined;
      const locationParts = this.extractLocation(line.replace(functionNameRegex, ''));

      return {
        functionName: functionName,
        fileName: locationParts[0],
        lineNumber: locationParts[1],
        columnNumber: locationParts[2],
        source: line
      };
    }, this);
  }
}
/* End of code originally copied from stacktrace.js */

/*
The code below is specific to CFS Logger - it leverages stacktrace.js plus some
additional parsing logic to handle Salesforce-specific stack traces in LWC & Aura components
*/
export default class LoggerStackTrace {
  parse(originStackTraceError) {
    if (!originStackTraceError) {
      return this;
    }

    const originStackTraceParticles = new ErrorStackParser().parse(originStackTraceError);
    let originStackTraceParticle;
    const parsedStackTraceLines = [];
    originStackTraceParticles.forEach(currentStackTraceParticle => {
      if (!originStackTraceParticle && currentStackTraceParticle.fileName?.endsWith('/logger.js')) {
        return;
      }

      const ignoredAuraFilenamesRegEx = /aura_prod(?:\.js|debug(?:\.js)?)$/;
      if (!originStackTraceParticle && ignoredAuraFilenamesRegEx.test(currentStackTraceParticle.fileName)) {
        return;
      }

      currentStackTraceParticle.source = currentStackTraceParticle.source?.trim();
      if (currentStackTraceParticle.source) {
        this._cleanStackTraceParticle(currentStackTraceParticle);
        originStackTraceParticle = originStackTraceParticle ?? currentStackTraceParticle;
        parsedStackTraceLines.push(currentStackTraceParticle.source);
      }
    });
    const parsedStackTraceString = parsedStackTraceLines.join('\n');
    return { ...originStackTraceParticle, parsedStackTraceString };
  }

  _cleanStackTraceParticle(stackTraceParticle) {
    const lwcModulesFileNamePrefix = 'modules/';
    if (stackTraceParticle.fileName?.startsWith(lwcModulesFileNamePrefix)) {
      stackTraceParticle.metadataType = 'LightningComponentBundle';

      stackTraceParticle.fileName = stackTraceParticle.fileName.substring(
        stackTraceParticle.fileName.indexOf(lwcModulesFileNamePrefix) + lwcModulesFileNamePrefix.length
      );
    }
    const auraComponentsContent = '/components/';
    if (stackTraceParticle.fileName?.indexOf(auraComponentsContent) > -1) {
      stackTraceParticle.metadataType = 'AuraDefinitionBundle';

      stackTraceParticle.fileName = stackTraceParticle.fileName.substring(
        stackTraceParticle.fileName.indexOf(auraComponentsContent) + auraComponentsContent.length,
        stackTraceParticle.fileName.length
      );
    }
    const jsFileNameSuffix = '.js';
    if (stackTraceParticle.fileName?.endsWith(jsFileNameSuffix)) {
      stackTraceParticle.componentName = stackTraceParticle.fileName.substring(0, stackTraceParticle.fileName.length - jsFileNameSuffix.length);
    }
    const invalidFunctionNameSuffix = '/<';
    if (stackTraceParticle.functionName?.endsWith(invalidFunctionNameSuffix)) {
      stackTraceParticle.functionName = stackTraceParticle.functionName.substring(0, stackTraceParticle.functionName.length - invalidFunctionNameSuffix.length);
    }
  }
}