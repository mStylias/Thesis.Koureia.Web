<#--
  The frame around every Koureia HTML email.

  The markup looks like 2004 because an email is not a web page. Outlook on Windows renders with
  Word's engine and Gmail strips `<head>` styles, so layout is nested presentation tables and
  every color and dimension is inline. The one `<style>` block is progressive enhancement, and
  the email is correct without it.

  CAUTION: The colors below are copied from `_tokens.scss` and `_light.scss`, because
  `var(--accent)` resolves to nothing in a mail client. Change them together:

    #9e5f28  --accent (brand-500)      #fbf8f2  --bg (paper)
    #915724  --accent-text             #ffffff  --surface, --accent-fg
    #1c1814  --text-primary            #e6dece  --border
    #5a4f43  --text-secondary          #fbf1e8  --accent-subtle (brand-50)
    #6f6355  --text-muted (neutral-500)

  `--accent` is a fill only. Text and links take `--accent-text`.

  No mail client has Alegreya, so the stacks fall to Georgia and the system sans.
-->
<#macro emailLayout preheader="">
<!DOCTYPE html>
<html lang="${locale.language}" dir="${(ltr)?then('ltr','rtl')}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<#-- Tells a dark-mode client to tone this design rather than invert it. -->
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${realmName}</title>
<style>
  /* Belt and braces. Every rule here restates an inline style. */
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
  a { color: #915724; }
  /* Apple Mail and iOS turn dates, addresses and numbers into blue links of their own. */
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  @media only screen and (max-width: 620px) {
    .kc-shell { width: 100% !important; }
    .kc-pad { padding-left: 24px !important; padding-right: 24px !important; }
    .kc-button a { display: block !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; width:100%; background-color:#fbf8f2; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">

<#-- Preview text: the line a client shows beside the subject. Hidden in the message, then padded
     so the client does not pull the body copy in after it. -->
<#if preheader?has_content>
<div style="display:none; font-size:1px; color:#fbf8f2; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">
  ${preheader}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
</div>
</#if>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fbf8f2;">
  <tr>
    <td align="center" style="padding:32px 12px;">

      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="kc-shell" style="width:600px; max-width:600px;">

        <#-- Wordmark as type, not an image: a logo file needs a public URL this theme cannot
             know, and most clients block remote images.

             CAUTION: Guard every variable in this frame. It wraps every HTML mail Keycloak
             sends, and a missing variable is a FreeMarker error, which means an email that
             never arrives. Use the parenthesized default: `properties.KOUREIA_APP_URL!""`
             still fails when `properties` itself is absent. -->
        <#assign appUrl = (properties.KOUREIA_APP_URL)!"">
        <#if (realmName!"")?has_content>
        <tr>
          <td align="center" style="padding:0 0 24px;">
            <#-- A nested table, not one cell: the mark and the word share a center line, and
                 `vertical-align` on table cells is the only way an email client agrees to that.
                 The markup repeats per branch instead of a captured variable, because these
                 templates are auto-escaped and a captured `<span>` prints as text. -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">
              <tr>
                <#-- Skipped without an app URL, because a relative src in an email points at the
                     mail client. The word alone is a complete wordmark. -->
                <#if appUrl?has_content>
                <td valign="middle" style="padding-right:10px; line-height:0;">
                  <a href="${appUrl}" target="_blank" rel="noopener">
                    <#-- Empty alt on purpose: the cell beside it spells the brand name, so a
                         blocked image must leave nothing rather than say it twice. -->
                    <img src="${appUrl}/brand/koureia_icon.png" width="32" height="32" alt="" style="display:block; border:0; outline:none; text-decoration:none; width:32px; height:32px;" />
                  </a>
                </td>
                </#if>
                <td valign="middle">
                  <span style="font-family:Alegreya,Georgia,'Times New Roman',serif; font-size:28px; line-height:32px; font-weight:700; letter-spacing:-0.01em; color:#1c1814;">
                    <#if appUrl?has_content>
                      <a href="${appUrl}" target="_blank" rel="noopener" style="color:#1c1814; text-decoration:none;">${realmName}<span style="color:#915724;">.</span></a>
                    <#else>
                      ${realmName}<span style="color:#915724;">.</span>
                    </#if>
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        </#if>

        <tr>
          <td class="kc-pad" style="background-color:#ffffff; border-radius:14px; padding:40px;">
            <#nested>
          </td>
        </tr>

        <tr>
          <td class="kc-pad" align="center" style="padding:24px 40px 0; font-family:'Alegreya Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:13px; line-height:20px; color:#6f6355;">
            ${msg("emailFooterAutomated")}
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>
</#macro>
