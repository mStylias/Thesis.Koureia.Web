<#ftl output_format="plainText">
<#--
  The plain-text alternative, built from the same keys as the HTML one so the two cannot drift
  apart in one language. A spam filter also scores a multipart message better when the text part
  is real and not stripped markup.

  `kc_locale` for the reason in the HTML template: `link` carries no language of its own.
-->
<#assign localizedLink = link + "&kc_locale=" + msg("localeCode")>
${msg("passwordResetHeading")}

${msg("passwordResetLead", realmName)}

${localizedLink}

${msg("passwordResetExpiry", linkExpirationFormatter(linkExpiration))}

${msg("passwordResetIgnore")}

--
${msg("emailFooterAutomated")}
