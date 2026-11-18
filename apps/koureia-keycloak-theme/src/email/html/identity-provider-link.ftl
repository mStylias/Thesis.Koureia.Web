<#import "template.ftl" as layout>
<@layout.emailLayout preheader=msg("identityProviderLinkPreheader")>
<#--
  Composed from single-purpose keys, not Keycloak's `identityProviderLinkBodyHtml`, which is one
  blob of markup inside a properties file. A designer must not edit a translation string to change
  structure, and a translator must not receive `<p>` tags.
-->
<#--
  `link` carries no language, so the page it opens falls back to the browser and answers a Greek
  mail with an English form. `kc_locale` is what a `login-actions` URL reads for it. See
  `password-reset.ftl` for why the language comes from the bundle and not from FreeMarker's
  `.lang`.
-->
<#assign localizedLink = link + "&kc_locale=" + msg("localeCode")>
<#--
  CAUTION: Guard both. A missing variable is a FreeMarker error, which means an email that never
  arrives, and this mail names a provider that an administrator can reconfigure. The display name
  is what the person recognises ("Google"); the alias is the internal one and reads as a slug.

  The account is the address the provider knows the person by. Google always sends one, but a
  provider that returns no email still has a username, and an empty pair of quotes in the middle
  of the sentence reads as a bug — `identityProviderLinkLeadPlain` is the sentence without it.
-->
<#assign providerName = (identityProviderDisplayName)!(identityProviderAlias)!"">
<#assign providerAccount = (identityProviderContext.email)!(identityProviderContext.username)!"">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
  <tr>
    <td style="font-family:Alegreya,Georgia,'Times New Roman',serif; font-size:26px; line-height:32px; font-weight:700; color:#1c1814; padding:0 0 16px;">
      ${msg("identityProviderLinkHeading", providerName)}
    </td>
  </tr>
  <tr>
    <td style="font-family:'Alegreya Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:16px; line-height:26px; color:#5a4f43; padding:0 0 16px;">
      <#if providerAccount?has_content>
        ${msg("identityProviderLinkLead", realmName, providerName, providerAccount)}
      <#else>
        ${msg("identityProviderLinkLeadPlain", realmName, providerName)}
      </#if>
    </td>
  </tr>
  <tr>
    <td style="font-family:'Alegreya Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:16px; line-height:26px; color:#5a4f43; padding:0 0 28px;">
      ${msg("identityProviderLinkAction")}
    </td>
  </tr>

  <#-- Bulletproof button: the color sits on the `<td>`, so Outlook on Windows paints a solid
       rectangle even though it drops `border-radius`. The padded anchor makes the whole block
       the click target. -->
  <tr>
    <td class="kc-button" style="padding:0 0 28px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" bgcolor="#9e5f28" style="background-color:#9e5f28; border-radius:10px;">
            <a href="${localizedLink}" target="_blank" rel="noopener" style="display:inline-block; padding:14px 28px; font-family:'Alegreya Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:16px; line-height:20px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:10px;">
              ${msg("identityProviderLinkCta")}
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="font-family:'Alegreya Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:14px; line-height:22px; color:#6f6355; padding:0 0 16px;">
      ${msg("identityProviderLinkExpiry", linkExpirationFormatter(linkExpiration))}
    </td>
  </tr>

  <tr>
    <td style="font-family:'Alegreya Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:16px; line-height:26px; color:#5a4f43; padding:0 0 28px;">
      ${msg("identityProviderLinkBenefit", realmName, providerName)}
    </td>
  </tr>

  <#-- The address in full, for a client that strips the anchor and for a reader who checks a
       link first. `word-break` because the token widens the table on a phone. -->
  <tr>
    <td style="font-family:'Alegreya Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:13px; line-height:20px; color:#6f6355; background-color:#fbf1e8; border-radius:10px; padding:16px; word-break:break-all;">
      ${msg("identityProviderLinkFallback")}<br />
      <a href="${localizedLink}" target="_blank" rel="noopener" style="color:#915724; text-decoration:underline;">${localizedLink}</a>
    </td>
  </tr>

  <tr>
    <td style="font-family:'Alegreya Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:14px; line-height:22px; color:#5a4f43; padding:24px 0 0;">
      ${msg("identityProviderLinkIgnore")}
    </td>
  </tr>
</table>
</@layout.emailLayout>
