<#ftl output_format="plainText">
<#--
  The plain-text alternative, built from the same keys as the HTML one so the two cannot drift
  apart in one language. A spam filter also scores a multipart message better when the text part
  is real and not stripped markup.

  There is no button here, so the address stands in for it and the fallback line is left out:
  repeating one link under a note about a button nobody can see reads as a mistake.

  `kc_locale` and the two guarded variables for the reasons in the HTML template.
-->
<#assign localizedLink = link + "&kc_locale=" + msg("localeCode")>
<#assign providerName = (identityProviderDisplayName)!(identityProviderAlias)!"">
<#assign providerAccount = (identityProviderContext.email)!(identityProviderContext.username)!"">
${msg("identityProviderLinkHeading", providerName)}

<#if providerAccount?has_content>
${msg("identityProviderLinkLead", realmName, providerName, providerAccount)}
<#else>
${msg("identityProviderLinkLeadPlain", realmName, providerName)}
</#if>

${msg("identityProviderLinkAction")}

${localizedLink}

${msg("identityProviderLinkExpiry", linkExpirationFormatter(linkExpiration))}

${msg("identityProviderLinkBenefit", realmName, providerName)}

${msg("identityProviderLinkIgnore")}

--
${msg("emailFooterAutomated")}
