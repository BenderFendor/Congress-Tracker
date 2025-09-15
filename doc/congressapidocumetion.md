Skip to content
Navigation Menu
LibraryOfCongress
api.congress.gov

Code
Issues 59
Pull requests 2
Actions
Projects
Security

    Insights

LibraryOfCongress/api.congress.gov
t
Name	Last commit message
	Last commit date
apreiter18
apreiter18
Update ChangeLog.md
7851e67
 · 
5 days ago
Documentation
	
Rename swagger (4).json to swagger.json
	
3 weeks ago
api_client
	
Update README.md
	
11 months ago
java
	
Edit Config.java
	
3 weeks ago
python
	
Fixed readme to use pip instead of pipenv for maximal cross platform …
	
2 weeks ago
.gitignore
	
update gitignore
	
3 years ago
ChangeLog.md
	
Update ChangeLog.md
	
5 days ago
README.md
	
Update README.md
	
11 months ago
secrets.ini
	
add files from leg_apps repo
	
3 years ago
Repository files navigation

    README

Overview
Introduction

The Congress.gov Application Programming Interface (API) provides a method for Congress and the public to view, retrieve, and re-use machine-readable data from collections available on Congress.gov. This repository contains information on accessing and using the Congress.gov API, as well as documentation on available endpoints.

Within the Congress.gov API, responses are returned in XML or JSON formats. An <api-root> element will be visible for responses returned in XML.

For every request, three elements are returned:

    The Request element contains information about the API request itself. This includes the format and the <contentType>; this is essentially the information you might expect to see in a request header.
    The Pagination element contains a count of how many total data items are contained within the response, a URL containing the next page of results; and, if the offset is greater than 1, a URL containing the previous page of results.
    The Data element, the name of which changes depending on the endpoint utilized (i.e. <bills> for the bill endpoint, <amendments> for the amendment endpoint, etc.). This element contains a list of all data items returned by your API call.

Keys

An API key is required for access. Sign up for a key here.

Learn more on how you can use your API key to access the Congress.gov API on api.data.gov.
Versioning

The current version of the API is version 3 (v3). Prior versions were used by the Government Publishing Office (GPO) for its Bulk Data Repository, and other clients.
Rate Limit

The rate limit is set to 5,000 requests per hour.
Limit and Offset

By default, the API returns 20 results starting with the first record. The 20 results limit can be adjusted up to 250 results. If the limit is adjusted to be greater than 250 results, only 250 results will be returned. The offset, or the starting record, can also be adjusted to be greater than 0.
Coverage and Estimated Update Times for Congress.gov Collections

Coverage information for Congress.gov collections data in the API can be found at Coverage Dates for Congress.gov Collections on Congress.gov. This page also provides estimated update times for Congress.gov collections.
Support

Congress.gov staff will monitor and respond to any issues created in this repository, and will initiate actions, as necessary. Before creating an issue in the repository, please review existing issues and add a comment to any issues relevant to yours.
Change Management

Congress.gov staff will issue change management communication through the ChangeLog so that consumers are able to adjust accordingly. The ChangeLog will contain information on updates to the API, the impacted endpoints, and the expected production release date. Milestones are also used to tag issues with expected production release date information.
Relevant Privacy Policies

    API keys and user registration follow the data.gov privacy policy. Read more here.
    API content follows the Library of Congress privacy policy. Read more here.

About

congress.gov API
Resources
Readme
Activity
Custom properties
Stars
822 stars
Watchers
68 watching
Forks
65 forks
Report repository
Releases
No releases published
Packages
No packages published
Contributors 13

    @apreiter18
    @aweiss27
    @emansfield7
    @104PL104
    @rgup
    @relarson1
    @ryparker
    @meshah2
    @gitgovdoc
    @lhridley
    @cheezedoodle2
    @anweloc
    @squealermusic

Languages

Java 59.7%
Python 37.1%

    Shell 3.2% 

Footer
© 2025 GitHub, Inc.
Footer navigation

    Terms
    Privacy
    Security
    Status
    GitHub Community
    Docs
    Contact



skip to main content
Congress.gov
Congress.gov API

Congress.gov shares its application programming interface (API) with the public to ingest the Congressional data. Sign up for an API key from api.data.gov that you can use to access web services provided by Congress.gov. To learn more, view our GitHub repository.
bill

Returns bill data from the API
GET
/bill
Returns a list of bills sorted by date of latest action.
GET
/bill/{congress}
Returns a list of bills filtered by the specified congress, sorted by date of latest action.
GET
/bill/{congress}/{billType}
Returns a list of bills filtered by the specified congress and bill type, sorted by date of latest action.
GET
/bill/{congress}/{billType}/{billNumber}
Returns detailed information for a specified bill.
GET
/bill/{congress}/{billType}/{billNumber}/actions
Returns the list of actions on a specified bill.
GET
/bill/{congress}/{billType}/{billNumber}/amendments
Returns the list of amendments to a specified bill.
GET
/bill/{congress}/{billType}/{billNumber}/committees
Returns the list of committees associated with a specified bill.
GET
/bill/{congress}/{billType}/{billNumber}/cosponsors
Returns the list of cosponsors on a specified bill.
GET
/bill/{congress}/{billType}/{billNumber}/relatedbills
Returns the list of related bills to a specified bill.
GET
/bill/{congress}/{billType}/{billNumber}/subjects
Returns the list of legislative subjects on a specified bill.
GET
/bill/{congress}/{billType}/{billNumber}/summaries
Returns the list of summaries for a specified bill.
GET
/bill/{congress}/{billType}/{billNumber}/text
Returns the list of text versions for a specified bill.
GET
/bill/{congress}/{billType}/{billNumber}/titles
Returns the list of titles for a specified bill.
GET
/law/{congress}
Returns a list of laws filtered by the specified congress.
GET
/law/{congress}/{lawType}
Returns a list of laws filtered by specified congress and law type (public or private).
GET
/law/{congress}/{lawType}/{lawNumber}
Returns a law filtered by specified congress, law type (public or private), and law number.
amendments

Returns amendment data from the API
GET
/amendment
Returns a list of amendments sorted by date of latest action.
GET
/amendment/{congress}
Returns a list of amendments filtered by the specified congress, sorted by date of latest action.
GET
/amendment/{congress}/{amendmentType}
Returns a list of amendments filtered by the specified congress and amendment type, sorted by date of latest action.
GET
/amendment/{congress}/{amendmentType}/{amendmentNumber}
Returns detailed information for a specified amendment.
GET
/amendment/{congress}/{amendmentType}/{amendmentNumber}/actions
Returns the list of actions on a specified amendment.
GET
/amendment/{congress}/{amendmentType}/{amendmentNumber}/cosponsors
Returns the list of cosponsors on a specified amendment.
GET
/amendment/{congress}/{amendmentType}/{amendmentNumber}/amendments
Returns the list of amendments to a specified amendment.
GET
/amendment/{congress}/{amendmentType}/{amendmentNumber}/text
Returns the list of text versions for a specified amendment from the 117th Congress onwards.
summaries

Returns summaries data from the API
GET
/summaries
Returns a list of summaries sorted by date of last update.
GET
/summaries/{congress}
Returns a list of summaries filtered by congress, sorted by date of last update.
GET
/summaries/{congress}/{billType}
Returns a list of summaries filtered by congress and by bill type, sorted by date of last update.
congress

Returns congress and congressional sessions data from the API
GET
/congress
Returns a list of congresses and congressional sessions.
GET
/congress/{congress}
Returns detailed information for a specified congress.
GET
/congress/current
Returns detailed information for the current congress.
member

Returns member data from the API
GET
/member
Returns a list of congressional members.
GET
/member/{bioguideId}
Returns detailed information for a specified congressional member.
GET
/member/{bioguideId}/sponsored-legislation
Returns the list of legislation sponsored by a specified congressional member.
GET
/member/{bioguideId}/cosponsored-legislation
Returns the list of legislation cosponsored by a specified congressional member.
GET
/member/congress/{congress}
Returns the list of members specified by Congress
GET
/member/{stateCode}
Returns a list of members filtered by state.
GET
/member/{stateCode}/{district}
Returns a list of members filtered by state and district.
GET
/member/congress/{congress}/{stateCode}/{district}
Returns a list of members filtered by congress, state and district.
[BETA] house-vote

Returns House of Representatives roll call vote data from the API
GET
/house-vote
Returns House of Representatives roll call vote data from the API. This endpoint is currently in beta.
GET
/house-vote/{congress}
Returns House of Representatives roll call vote data from the API filtered by the specified Congress. This endpoint is currently in beta.
GET
/house-vote/{congress}/{session}
Returns House of Representatives roll call vote data from the API filtered by the specified Congress and session. This endpoint is currently in beta.
GET
/house-vote/{congress}/{session}/{voteNumber}
Returns detailed information for a specified House of Representatives roll call vote. This endpoint is currently in beta.
GET
/house-vote/{congress}/{session}/{voteNumber}/members
Returns detailed information for how members voted on a specified House of Representatives roll call vote. This endpoint is currently in beta.
committee

Returns committee data from the API
GET
/committee
Returns a list of congressional committees.
GET
/committee/{chamber}
Returns a list of congressional committees filtered by the specified chamber.
GET
/committee/{congress}
Returns a list of congressional committees filtered by the specified congress.
GET
/committee/{congress}/{chamber}
Returns a list of committees filtered by the specified congress and chamber.
GET
/committee/{chamber}/{committeeCode}
Returns detailed information for a specified congressional committee.
GET
/committee/{chamber}/{committeeCode}/bills
Returns the list of legislation associated with the specified congressional committee.
GET
/committee/{chamber}/{committeeCode}/reports
Returns the list of committee reports associated with a specified congressional committee.
GET
/committee/{chamber}/{committeeCode}/nominations
Returns the list of nominations associated with a specified congressional committee.
GET
/committee/{chamber}/{committeeCode}/house-communication
Returns the list of House communications associated with a specified congressional committee.
GET
/committee/{chamber}/{committeeCode}/senate-communication
Returns the list of Senate communications associated with a specified congressional committee.
committee-report

Returns committee report data from the API
GET
/committee-report
Returns a list of committee reports.
GET
/committee-report/{congress}
Returns a list of committee reports filtered by the specified congress.
GET
/committee-report/{congress}/{reportType}
Returns a list of committee reports filtered by the specified congress and report type.
GET
/committee-report/{congress}/{reportType}/{reportNumber}
Returns detailed information for a specified committee report.
GET
/committee-report/{congress}/{reportType}/{reportNumber}/text
Returns the list of texts for a specified committee report.
committee-print

Returns committee print data from the API
GET
/committee-print
Returns a list of committee prints.
GET
/committee-print/{congress}
Returns a list of committee prints filtered by the specified congress.
GET
/committee-print/{congress}/{chamber}
Returns a list of committee prints filtered by the specified congress and chamber.
GET
/committee-print/{congress}/{chamber}/{jacketNumber}
Returns detailed information for a specified committee print.
GET
/committee-print/{congress}/{chamber}/{jacketNumber}/text
Returns the list of texts for a specified committee print.
committee-meeting

Returns committee meeting data from the API
GET
/committee-meeting
Returns a list of committee meetings.
GET
/committee-meeting/{congress}
Returns a list of committee meetings filtered by the specified congress.
GET
/committee-meeting/{congress}/{chamber}
Returns a list of committee meetings filtered by the specified congress and chamber.
GET
/committee-meeting/{congress}/{chamber}/{eventId}
Returns detailed information for a specified committee meeting.
hearing

Returns hearing data from the API
GET
/hearing
Returns a list of hearings.
GET
/hearing/{congress}
Returns a list of hearings filtered by the specified congress.
GET
/hearing/{congress}/{chamber}
Returns a list of hearings filtered by the specified congress and chamber.
GET
/hearing/{congress}/{chamber}/{jacketNumber}
Returns detailed information for a specified hearing.
congressional-record

Returns Congressional Record data from the API
GET
/congressional-record
Returns a list of congressional record issues sorted by most recent.
daily-congressional-record

Returns daily Congressional Record data from the API
GET
/daily-congressional-record
Returns a list of daily congressional record issues sorted by most recent.
GET
/daily-congressional-record/{volumeNumber}
Returns a list of daily Congressional Records filtered by the specified volume number.
GET
/daily-congressional-record/{volumeNumber}/{issueNumber}
Returns a list of daily Congressional Records filtered by the specified volume number and specified issue number.
GET
/daily-congressional-record/{volumeNumber}/{issueNumber}/articles
Returns a list of daily Congressional Record articles filtered by the specified volume number and specified issue number.
bound-congressional-record

Returns bound Congressional Record data from the API
GET
/bound-congressional-record
Returns a list of bound Congressional Records sorted by most recent.
GET
/bound-congressional-record/{year}
Returns a list of bound Congressional Records filtered by the specified year.
GET
/bound-congressional-record/{year}/{month}
Returns a list of bound Congressional Records filtered by the specified year and specified month.
GET
/bound-congressional-record/{year}/{month}/{day}
Returns a list of bound Congressional Records filtered by the specified year, specified month and specified day.
house-communication

Returns House communication data from the API
GET
/house-communication
Returns a list of House communications.
GET
/house-communication/{congress}
Returns a list of House communications filtered by the specified congress.
GET
/house-communication/{congress}/{communicationType}
Returns a list of House communications filtered by the specified congress and communication type.
GET
/house-communication/{congress}/{communicationType}/{communicationNumber}
Returns detailed information for a specified House communication.
house-requirement

Returns House requirement data from the API
GET
/house-requirement
Returns a list of House requirements.
GET
/house-requirement/{requirementNumber}
Returns detailed information for a specified House requirement.
GET
/house-requirement/{requirementNumber}/matching-communications
Returns a list of matching communications to a House requirement.
senate-communication

Returns Senate communication data from the API
GET
/senate-communication
Returns a list of Senate communications.
GET
/senate-communication/{congress}
Returns a list of Senate communications filtered by the specified congress.
GET
/senate-communication/{congress}/{communicationType}
Returns a list of Senate communications filtered by the specified congress and communication type.
GET
/senate-communication/{congress}/{communicationType}/{communicationNumber}
Returns detailed information for a specified Senate communication.
nomination

Returns nomination data from the API
GET
/nomination
Returns a list of nominations sorted by date received from the President.
GET
/nomination/{congress}
Returns a list of nominations filtered by the specified congress and sorted by date received from the President.
GET
/nomination/{congress}/{nominationNumber}
Returns detailed information for a specified nomination.
GET
/nomination/{congress}/{nominationNumber}/{ordinal}
Returns the list nominees for a position within the nomination.
GET
/nomination/{congress}/{nominationNumber}/actions
Returns the list of actions on a specified nomination.
GET
/nomination/{congress}/{nominationNumber}/committees
Returns the list of committees associated with a specified nomination.
GET
/nomination/{congress}/{nominationNumber}/hearings
Returns the list of printed hearings associated with a specified nomination.
crsreport

Returns Congressional Research Service (CRS) report data from the API
GET
/crsreport
Returns Congressional Research Service (CRS) report data from the API
GET
/crsreport/{reportNumber}
Returns detailed information for a specificed Congressional Research Service (CRS) report
treaty

Returns treaty data from the API
GET
/treaty
Returns a list of treaties sorted by date of last update.
GET
/treaty/{congress}
Returns a list of treaties for the specified congress, sorted by date of last update.
GET
/treaty/{congress}/{treatyNumber}
Returns detailed information for a specified treaty.
GET
/treaty/{congress}/{treatyNumber}/{treatySuffix}
Returns detailed information for a specified partitioned treaty.
GET
/treaty/{congress}/{treatyNumber}/actions
Returns the list of actions on a specified treaty.
GET
/treaty/{congress}/{treatyNumber}/{treatySuffix}/actions
Returns the list of actions on a specified partitioned treaty.
GET
/treaty/{congress}/{treatyNumber}/committees
Returns the list of committees associated with a specified treaty.

    Legal Visit Congress.gov 

